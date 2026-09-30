<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRecorder } from './composables/useRecorder'
import { useScreenshot } from './composables/useScreenshot'

// ── 代理地址 ────────────────────────────────────────────────────────
const PROXY_BASE = window.__LptvProxyBase || 'http://localhost:9100'

const LptvApi = {
  async _post(path, body) {
    const r = await fetch(PROXY_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return r.json()
  },
  async _get(path) { return (await fetch(PROXY_BASE + path)).json() },
  getChannels: () => LptvApi._get('/api/channels'),
  getState: () => LptvApi._get('/api/state'),
  setState: (p) => LptvApi._post('/api/state', p),
  recOpen: (ch) => LptvApi._post('/api/record/open', { channel: ch }),
  recClose: (id) => LptvApi._post('/api/record/close', { id }),
  shotSave: (ch, data) => LptvApi._post('/api/shot', { channel: ch, data }),
  fetchEpg: (pid, ymd) => LptvApi._get(`/capi/yspepg/program/${pid}/${ymd}`),
}

const LptvState = (() => {
  const KEY = 'lptv.cfg.v3'
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
  function save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {} }
  let _pending = null, _timer = null
  function flush(patch) {
    _pending = Object.assign(_pending || {}, patch)
    clearTimeout(_timer)
    _timer = setTimeout(async () => {
      const p = _pending; _pending = null
      try { await LptvApi.setState(p) } catch (e) { console.warn('[LPTV] state sync failed:', e) }
    }, 800)
  }
  return { load, save, flush }
})()

// ── 状态 ───────────────────────────────────────────────────────────
const channels = ref([])
const favs = ref([])
const lastPid = ref('')
const resumeLast = ref(true)
const filterTab = ref('all')
const showPanel = ref(false)
const showSettings = ref(false)
const showEpg = ref(false)
const showAbout = ref(false)
const showOsdtip = ref(false)
const osdText = ref('')
const osdName = ref('')
const osdSub = ref('')
const volTip = ref(null)
const toastMsg = ref('')
const toastShow = ref(false)
const isLoading = ref(true)
const loadError = ref(false)
const currentChannel = ref(null)
const currentPid = ref('')
const volume = ref(100)
const isMuted = ref(false)
const isPlaying = ref(true)
const isRecording = ref(false)
const recTime = ref('00:00')
const recBytes = ref(0)
const epgDayOffset = ref(0)
const epgPrograms = ref([])
const epgLoading = ref(false)
const epgDateLabelVal = ref('')
const mouseActive = ref(true)
const devHidden = ref(false)
const digits = ref('')
const settings = ref({ fit: 'contain', recDir: './records/', shotDir: './shots/' })

// 防过期响应
let _pidBefore = '', _switchAt = 0

let digitTimer = null, recTickTimer = null, keyHandler = null, idleTimer = null, ctrlTimer = null
let frameReady = false, recInst = null, darkCount = 0, ctrlHoverTimer = null
const showControlBar = ref(false)

const recorder = useRecorder()
const screenshot = useScreenshot()

// ── 计算属性 ───────────────────────────────────────────────────────
const filteredChannels = computed(() => {
  if (filterTab.value === 'fav') return channels.value.filter(c => favs.value.includes(c.pid))
  return channels.value
})

const channelCategories = computed(() => {
  const cats = {}
  channels.value.forEach(c => { const cat = c.category || '地方'; (cats[cat] = cats[cat] || []).push(c) })
  return ['央视', 'CGTN', '卫视', '地方', '其他'].filter(k => cats[k])
})

const epgDates = computed(() => {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const result = []
  for (let i = 0; i <= 3; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    const label = i === 0 ? '今天' : i === 1 ? '明天' : '周' + days[d.getDay()]
    const sub = i > 0 ? (d.getMonth() + 1) + '/' + d.getDate() : ''
    result.push({ label, sub, active: i === 0, offset: i, isRes: false })
  }
  const res = JSON.parse(localStorage.getItem('lptv.res.v1') || '[]')
  result.push({ label: '预约', sub: res.length || '', active: false, isRes: true })
  return result
})

// ── 工具函数 ───────────────────────────────────────────────────────
function inferCategory(t) {
  if (/^CGTN/.test(t)) return 'CGTN'
  if (/^CCTV/.test(t) || /4K|8K/.test(t)) return '央视'
  if (/教育/.test(t)) return '其他'
  if (/卫视/.test(t)) return '卫视'
  return '地方'
}
function ymdStr(dt) { return dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') }
function epgYmdOf(off) { const d = new Date(); d.setDate(d.getDate() + (off || 0)); return ymdStr(d) }
function epgDateStr(dt) { const days = ['日','一','二','三','四','五','六']; return (dt.getMonth()+1) + '月' + dt.getDate() + '日 星期' + days[dt.getDay()] }

// ── EPG protobuf 解析 ──────────────────────────────────────────────
function utf8Bytes(bytes, a, n) {
  try { if (window.TextDecoder) return new TextDecoder().decode(bytes.subarray(a, a + n)) } catch {}
  try { let s = ''; for (let i = a; i < a + n; i++) s += String.fromCharCode(bytes[i]); return decodeURIComponent(escape(s)) } catch { return '' }
}
function parseEpgEntry(bytes, a, b) {
  let i = a, p = {}
  function vi() { let v = 0, s = 0, k = 0; while (i < b && k < 5) { const x = bytes[i++]; v += (x & 0x7f) * (1 << s); s += 7; k++; if (!(x & 0x80)) break }; return v }
  try { while (i < b) { const tag = vi(); if (tag === 0) break; const f = tag >>> 3, wt = tag & 7
    if (wt === 2) { const len = vi(); if (i + len > b) break; if (f === 1) p.id = utf8Bytes(bytes, i, len); else if (f === 2) p.name = utf8Bytes(bytes, i, len); else if (f === 5) p.start = utf8Bytes(bytes, i, len); else if (f === 6) p.end = utf8Bytes(bytes, i, len); i += len }
    else if (wt === 0) { const v = vi(); if (f === 3) p.s0 = v; else if (f === 4) p.e0 = v; else if (f === 7) p.dur = v }
    else { i += vi() }
  } } catch {}
  return p.name ? p : null
}
function parseEpg(buf) {
  const programs = []
  try {
    const bytes = new Uint8Array(buf); let i = 0
    function vi() { let v = 0, s = 0, k = 0; while (i < bytes.length && k < 5) { const b = bytes[i++]; v += (b & 0x7f) * (1 << s); s += 7; k++; if (!(b & 0x80)) break }; return v }
    while (i < bytes.length) { const tag = vi(); if (tag === 0) break; const f = tag >>> 3, wt = tag & 7
      if (wt === 2) { const len = vi(); const p = parseEpgEntry(bytes, i, i + len); if (p) programs.push(p); i += len }
      else if (wt === 0) { vi() } else { i += vi() }
      if (programs.length > 200) break
    }
  } catch {}
  return programs
}

// ── 预约管理 ───────────────────────────────────────────────────────
function resLoad() { try { return JSON.parse(localStorage.getItem('lptv.res.v1') || '[]') } catch { return [] } }
function resSave(list) { try { localStorage.setItem('lptv.res.v1', JSON.stringify(list)) } catch {} LptvState.flush({ res: list }) }
function resHas(pid, s0) { return resLoad().some(r => r.id === (pid + '_' + s0)) }
function resToggle(pid, s0, e0, name) {
  const id = pid + '_' + s0, list = resLoad(), i = list.findIndex(r => r.id === id), had = i >= 0
  if (had) list.splice(i, 1)
  else list.push({ id, pid: String(pid), ch: currentChannel.value?.name || '', name: name || '', s0, e0: e0 || 0, made: Date.now() })
  resSave(list); return !had
}

// ── 加载频道 ───────────────────────────────────────────────────────
async function loadChannels() {
  try {
    const r = await LptvApi.getChannels()
    if (r && r.data && r.data.channelList) {
      channels.value = r.data.channelList.map(c => ({
        pid: String(c.channelId || c.id || ''), name: c.name || c.channelName || '未知',
        official: c.name || c.channelName || '', category: inferCategory(c.name || ''), live: false,
      })).filter(c => !/限免|VIP/.test(c.name))
    }
  } catch (e) { console.error('[LPTV] loadChannels failed:', e) }
  isLoading.value = false
  try {
    const st = await LptvApi.getState()
    if (st && st.ok) {
      if (Array.isArray(st.favs) && st.favs.length) favs.value = st.favs.filter(pid => channels.value.some(c => c.pid === pid))
      if (typeof st.resumeLast === 'boolean') resumeLast.value = st.resumeLast
      if (st.lastPid) lastPid.value = st.lastPid
      if (Array.isArray(st.res)) try { localStorage.setItem('lptv.res.v1', JSON.stringify(st.res)) } catch {}
    }
  } catch {}
  const m = location.href.match(/[?&]pid=(\d+)/); let startPid = m ? m[1] : ''
  if (!startPid && resumeLast.value && lastPid.value && channels.value.some(c => c.pid === lastPid.value)) startPid = lastPid.value
  if (startPid && channels.value.some(c => c.pid === startPid)) switchChannel(startPid)
  else if (channels.value.length) switchChannel(channels.value[0].pid)
}

// ── 频道切换（含防过期响应）────────────────────────────────────────
function switchChannel(pid) {
  const ch = channels.value.find(c => c.pid === pid); if (!ch) return
  if (pid !== currentPid.value) { _pidBefore = currentPid.value; _switchAt = Date.now() }
  currentPid.value = pid; currentChannel.value = ch; lastPid.value = pid
  LptvState.flush({ lastPid: pid })
  if (frameEl) frameEl.src = PROXY_BASE + '/_page?pid=' + pid
  const idx = channels.value.findIndex(c => c.pid === pid)
  showOsdTip(String(idx + 1).padStart(2, '0'), ch.name)
}

function showOsdTip(num, name, sub) {
  osdText.value = num; osdName.value = name; osdSub.value = sub || ''
  showOsdtip.value = true
  clearTimeout(showOsdTip._t); showOsdTip._t = setTimeout(() => { showOsdtip.value = false }, 2800)
}

// ── 数字选台 ───────────────────────────────────────────────────────
function handleDigit(d) {
  digits.value += d; showOsdTip(digits.value, '', '')
  clearTimeout(digitTimer)
  if (digits.value.length >= 3) commitDigits()
  else digitTimer = setTimeout(commitDigits, 900)
}
function commitDigits() {
  const n = parseInt(digits.value, 10); digits.value = ''; showOsdtip.value = false
  if (n >= 1 && n <= channels.value.length) switchChannel(channels.value[n - 1].pid)
  else showToast('没有频道 ' + n)
}

// ── 切台 ───────────────────────────────────────────────────────────
function stepChannel(delta) {
  if (!channels.value.length) return
  const idx = channels.value.findIndex(c => c.pid === currentPid.value)
  const next = (idx < 0 ? 0 : idx + delta + channels.value.length) % channels.value.length
  switchChannel(channels.value[next].pid)
}

// ── 音量 ───────────────────────────────────────────────────────────
function setVolume(v) {
  v = Math.max(0, Math.min(100, v)); volume.value = v; isMuted.value = v === 0
  LptvState.flush({ volume: v / 100, muted: isMuted.value })
  volTip.value = v; clearTimeout(volTip._t); volTip._t = setTimeout(() => { volTip.value = null }, 1400)
}
function toggleMute() {
  isMuted.value = !isMuted.value
  if (isMuted.value) LptvState.flush({ muted: true })
  else LptvState.flush({ muted: false, volume: volume.value / 100 })
  volTip.value = isMuted.value ? 0 : volume.value
  clearTimeout(volTip._t); volTip._t = setTimeout(() => { volTip.value = null }, 1400)
}
function togglePlay() { isPlaying.value = !isPlaying.value }

// ── 收藏 ───────────────────────────────────────────────────────────
function toggleFav(pid) {
  const i = favs.value.indexOf(pid)
  if (i >= 0) favs.value.splice(i, 1); else favs.value.push(pid)
  LptvState.flush({ favs: favs.value })
  showToast(i >= 0 ? '已取消收藏' : '已收藏')
}
function selectChannel(ch) { currentChannel.value = ch; showPanel.value = false }

// ── 录制 ───────────────────────────────────────────────────────────
async function recToggle() {
  if (isRecording.value) {
    if (recInst) { await recInst.stopRecording(); recInst = null }
    isRecording.value = false; clearInterval(recTickTimer); recTime.value = '00:00'
    showToast('录制已保存')
  } else {
    const videoEl = getVideoElement()
    try {
      recInst = recorder.use(videoEl, currentChannel.value?.name || '直播')
      await recInst.open(); isRecording.value = true
      recTickTimer = setInterval(() => {
        if (recInst) {
          const s = recInst.duration.value
          recTime.value = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
          recBytes.value = recInst.bytes.value
        }
      }, 1000)
      showToast('开始录制')
    } catch (e) { showToast('录制失败: ' + e.message) }
  }
}

// ── 截图 ───────────────────────────────────────────────────────────
async function shotTake() {
  const videoEl = getVideoElement()
  const r = await screenshot.capture(videoEl, currentChannel.value?.name || '直播')
  if (r?.ok) {
    showToast('已截图 · ' + r.name)
    const fl = document.getElementById('lptv-shot-flash')
    if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go') }
  } else { showToast('截图失败: ' + (r?.error || '')) }
}

function getVideoElement() {
  if (!frameEl) return null
  try {
    const doc = frameEl.contentDocument; if (!doc) return null
    const vids = doc.querySelectorAll('video'); let best = null
    vids.forEach(v => { if (v.videoWidth && (!best || v.videoWidth > best.videoWidth)) best = v })
    return best
  } catch { return null }
}

// ── EPG ────────────────────────────────────────────────────────────
async function fetchEpg(pid, ymd) {
  if (!pid || !/^\d+$/.test(String(pid))) return
  epgLoading.value = true
  try {
    const r = await LptvApi.fetchEpg(pid, ymd)
    if (r && r.data) epgPrograms.value = parseEpg(r.data).map(p => ({ ...p, reserved: resHas(pid, p.s0) }))
  } catch (e) { console.warn('[LPTV] epgFetch err:', e) }
  finally { epgLoading.value = false }
}
function selectEpgDate(d) {
  epgDates.value.forEach(x => x.active = false); d.active = true
  if (d.isRes) return
  epgDayOffset.value = d.offset || 0
  epgDateLabelVal.value = epgDateStr(new Date(Date.now() + (epgDayOffset.value || 0) * 86400000))
  if (currentPid.value) fetchEpg(currentPid.value, epgYmdOf(epgDayOffset.value))
}
function toggleRes(p) {
  const pid = currentPid.value; if (!pid || !p.s0) return
  const on = resToggle(pid, p.s0, p.e0, p.name); p.reserved = on
  showToast(on ? '已预约: ' + p.name : '已取消预约')
}

// ── Toast ──────────────────────────────────────────────────────────
function showToast(msg) {
  toastMsg.value = msg; toastShow.value = true
  clearTimeout(showToast._t); showToast._t = setTimeout(() => { toastShow.value = false }, 2600)
}
function openDir(dir) { showToast('目录: ' + dir) }

// ── 黑帧看门狗 ─────────────────────────────────────────────────────
const wcanvas = document.createElement('canvas')
wcanvas.width = 48; wcanvas.height = 27
const wctx = wcanvas.getContext('2d')
setInterval(() => {
  if (devHidden.value) return
  const v = getVideoElement()
  if (!v || v.paused || v.readyState < 2 || !v.videoWidth) return
  try {
    wctx.drawImage(v, 0, 0, 48, 27)
    const d = wctx.getImageData(0, 0, 48, 27).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i+1] + d[i+2]
    const avg = sum / ((d.length / 4) * 3)
    if (avg < 12) {
      darkCount++
      if (darkCount >= 3) { darkCount = 0; showToast('检测到黑帧，已自动恢复'); switchChannel(currentPid.value) }
    } else { darkCount = 0 }
  } catch {}
}, 4000)

// ── idle / 控制栏自动隐藏 ──────────────────────────────────────────
function wake() {
  if (devHidden.value) return
  mouseActive.value = true
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => { mouseActive.value = false }, 3500)
}
function scheduleHideControls() {
  clearTimeout(ctrlTimer)
  ctrlTimer = setTimeout(() => { showSettings.value = false }, 900)
}
function cancelHideControls() { clearTimeout(ctrlTimer) }
function onCtrlMouseEnter() {
  showControlBar.value = true
  clearTimeout(ctrlHoverTimer)
}
function onCtrlMouseLeave() {
  ctrlHoverTimer = setTimeout(() => { showControlBar.value = false }, 200)
}

// ── 快捷键 ─────────────────────────────────────────────────────────
function bindKeyEvents() {
  keyHandler = (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
    const k = e.key
    if (e.ctrlKey && (k === 'd' || k === 'D')) { e.preventDefault(); devHidden.value = !devHidden.value; showToast(devHidden.value ? '已隐藏界面（Ctrl+D 恢复）' : '已恢复界面'); return }
    if (devHidden.value) return
    if (/^[0-9]$/.test(k)) { e.preventDefault(); handleDigit(k) }
    else if (k === 'ArrowUp') { e.preventDefault(); stepChannel(-1) }
    else if (k === 'ArrowDown') { e.preventDefault(); stepChannel(1) }
    else if (k === 'PageUp') { e.preventDefault(); stepChannel(-1) }
    else if (k === 'PageDown') { e.preventDefault(); stepChannel(1) }
    else if (k === 'ArrowLeft') { e.preventDefault(); setVolume(volume.value - 5) }
    else if (k === 'ArrowRight') { e.preventDefault(); setVolume(volume.value + 5) }
    else if (k === 'Enter' && showPanel.value) { e.preventDefault(); const active = document.querySelector('.channel-item.active'); if (active) active.click() }
    else if (k === ' ') { e.preventDefault(); togglePlay() }
    else if (k === 'm' || k === 'M') { if (!e.ctrlKey && !e.altKey) { e.preventDefault(); toggleMute() } }
    else if (k === 's' || k === 'S') { if (!e.ctrlKey && !e.altKey) { e.preventDefault(); showPanel.value = !showPanel.value; showEpg.value = false; showSettings.value = false } }
    else if (k === 'e' || k === 'E') { if (!e.ctrlKey && !e.altKey) { e.preventDefault(); showEpg.value = !showEpg.value; showPanel.value = false; showSettings.value = false } }
    else if (k === 'r' || k === 'R') { if (!e.ctrlKey && !e.altKey) { e.preventDefault(); recToggle() } }
    else if (k === 'x' || k === 'X') { if (!e.ctrlKey && !e.altKey) { e.preventDefault(); shotTake() } }
    else if (k === 'F11') { e.preventDefault(); document.documentElement.requestFullscreen?.() }
    else if (k === 'Escape') { showPanel.value = false; showEpg.value = false; showSettings.value = false; showAbout.value = false }
    wake()
  }
  document.addEventListener('keydown', keyHandler)

  // 鼠标滚轮音量
  document.addEventListener('wheel', (e) => {
    if (e.target.closest('#lptv-panel,#lptv-settings,#lptv-epg')) return
    e.preventDefault()
    setVolume(volume.value + (e.deltaY < 0 ? 5 : -5))
  }, { passive: false })

  // 页面隐藏时停止录制
  document.addEventListener('visibilitychange', () => {
    if (isRecording.value && document.visibilityState === 'hidden') {
      showToast('页面已隐藏，录制自动停止')
      recToggle()
    }
  })
}

// ── iframe ref ─────────────────────────────────────────────────────
const frameEl = ref(null)
function onFrameLoad() { frameReady = true; isLoading.value = false }

// ── 初始化 ─────────────────────────────────────────────────────────
onMounted(async () => {
  bindKeyEvents()
  wake()
  try {
    const r = await fetch(PROXY_BASE + '/api/state', { signal: AbortSignal.timeout(3000) })
    if (!r.ok) throw new Error('HTTP ' + r.status)
  } catch { loadError.value = true; isLoading.value = false; return }
  await loadChannels()
  setInterval(() => { if (showEpg.value && currentPid.value) fetchEpg(currentPid.value, epgYmdOf(epgDayOffset.value)) }, 30000)
})

onUnmounted(() => {
  if (keyHandler) document.removeEventListener('keydown', keyHandler)
  if (recTickTimer) clearInterval(recTickTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (ctrlTimer) clearTimeout(ctrlTimer)
})
</script>

<template>
  <div class="app-root" :class="{ idle: !mouseActive, 'dev-hidden': devHidden }">
    <!-- 加载遮罩 -->
    <div v-if="isLoading && !loadError" id="lptv-loader">
      <div class="spinner"></div>
      <div class="label">正在连接直播源…</div>
    </div>
    <div v-else-if="loadError" id="lptv-error" class="show">
      <h2>连接失败</h2>
      <p>无法连接到代理服务器。请确认代理已启动：<br>
        <code style="color:#7d9bff">python proxy/server.py</code><br>
        然后刷新本页面。</p>
      <button @click="location.reload()">重试</button>
    </div>

    <!-- 视频 iframe -->
    <iframe
      v-show="!isLoading"
      ref="frameEl"
      id="lptv-video-frame"
      :src="currentPid ? PROXY_BASE + '/_page?pid=' + currentPid : ''"
      frameborder="0" allowfullscreen
      @load="onFrameLoad"
    />

    <!-- 截图白闪 -->
    <div id="lptv-shot-flash" class="shot-flash"></div>

    <!-- OSD 提示 -->
    <transition name="fade">
      <div v-if="showOsdtip" class="osd-tip">
        <div class="osd-num">{{ osdText }}</div>
        <div class="osd-name">{{ osdName }}</div>
        <div v-if="osdSub" class="osd-sub">{{ osdSub }}</div>
      </div>
    </transition>

    <!-- 音量提示 -->
    <transition name="fade">
      <div v-if="volTip !== null" class="vol-tip">
        <div class="vol-bar-wrap"><div class="vol-bar" :style="{ height: volTip + '%' }"></div></div>
        <span class="vol-val">{{ volTip }}%</span>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastShow" class="lptv-toast">{{ toastMsg }}</div>
    </transition>

    <!-- 台标 -->
    <div v-if="currentChannel && !showPanel && !showEpg" class="channel-logo">
      <div class="logo-main">
        <span class="logo-text">{{ currentChannel.official?.split(' ')[0] || 'CCTV' }}</span>
        <div class="logo-num-badge">{{ channels.findIndex(c => c.pid === currentPid) + 1 || '--' }}</div>
      </div>
      <div class="logo-underline"></div>
      <div class="logo-name">{{ (currentChannel.name.split(' ')[1]) || currentChannel.name }}</div>
    </div>

    <!-- 录制角标 -->
    <transition name="fade">
      <div v-if="isRecording" class="rec-badge">
        <span class="rec-dot"></span>
        <span class="rec-time">REC {{ recTime }} · {{ (recBytes / 1048576).toFixed(1) }}MB</span>
      </div>
    </transition>

    <!-- ── 控制栏 ─────────────────────────────────────────────────── -->
    <transition name="ctrl-slide">
      <div v-if="showControlBar && currentChannel && !devHidden" class="control-bar" @mouseenter="onCtrlMouseEnter" @mouseleave="onCtrlMouseLeave">
      <div class="glass control-strip">
        <div class="highlight-line"></div>
        <div class="ctrl-row ctrl-row--1">
          <div class="play-controls">
            <button class="btn btn--circle btn--ghost" title="上一台 (↑)" @click="stepChannel(-1)"><i class="ri-skip-back-mini-line"></i></button>
            <div class="play-btn-wrap">
              <button class="btn btn--play" @click="togglePlay" title="播放/暂停 (空格)">
                <i :class="isPlaying ? 'ri-pause-mini-line' : 'ri-play-mini-line'"></i>
              </button>
            </div>
            <button class="btn btn--circle btn--ghost" title="下一台 (↓)" @click="stepChannel(1)"><i class="ri-skip-forward-mini-line"></i></button>
          </div>
          <div class="play-status">
            <span class="live-dot"></span>
            <span class="status-chname">{{ currentChannel.name }}</span>
            <span class="status-sep">·</span>
            <span class="status-prog">{{ currentChannel.official }}</span>
          </div>
          <div class="volume-group">
            <button class="btn btn--circle btn--ghost vol-btn" title="静音 (M)" @click="toggleMute">
              <i :class="isMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line'"></i>
            </button>
            <div class="volume-slider-wrap">
              <div class="volume-track">
                <div class="volume-fill" :style="{ width: volume + '%' }"></div>
                <div class="volume-knob" :style="{ left: `calc(${volume}% - 7px)` }"></div>
              </div>
              <input type="range" min="0" max="100" v-model="volume" class="volume-input" @input="setVolume(volume)" />
            </div>
            <span class="volume-num">{{ volume }}</span>
          </div>
          <div class="rec-shot-group">
            <button class="btn btn--circle" :class="isRecording ? 'btn--rec' : 'btn--ghost'" title="录制节目 (R)" @click="recToggle"><i class="ri-record-circle-line"></i></button>
            <button class="btn btn--circle btn--ghost" title="截图 (X)" @click="shotTake"><i class="ri-camera-line"></i></button>
          </div>
        </div>
        <div class="ctrl-divider"></div>
        <div class="ctrl-row ctrl-row--2">
          <button class="btn btn--pill" :class="showEpg ? 'btn--active' : ''" @click="showEpg=!showEpg; showPanel=false; showSettings=false"><span>节目单</span></button>
          <button class="btn btn--pill" :class="showPanel ? 'btn--active' : ''" @click="showPanel=!showPanel; showEpg=false; showSettings=false"><span>频道</span></button>
          <button class="btn btn--circle" :class="showSettings ? 'btn--active-blue' : 'btn--ghost'" title="设置" @click="showSettings=!showSettings; showPanel=false; showEpg=false"><i class="ri-settings-3-line"></i></button>
        </div>
      </div>
    </div>
    </transition>

    <!-- ── 频道列表侧栏 ─────────────────────────────────────────── -->
    <transition name="slide">
      <div v-if="showPanel" id="lptv-panel" class="channel-sidebar">
        <div class="sidebar-header"><span class="sidebar-title">频道列表</span></div>
        <div class="current-ch-card">
          <span class="current-ch-num">{{ channels.findIndex(c => c.pid === currentPid) + 1 || '--' }}</span>
          <div class="current-ch-info">
            <div class="current-ch-name">{{ currentChannel?.name || '--' }}</div>
            <div class="current-ch-sub">正在直播</div>
          </div>
        </div>
        <div class="filter-tabs">
          <div class="filter-tab" :class="{ active: filterTab==='all' }" @click="filterTab='all'"><span>全部</span></div>
          <div class="filter-tab" :class="{ active: filterTab==='fav' }" @click="filterTab='fav'"><span>收藏</span></div>
        </div>
        <template v-if="filterTab==='all'">
          <div v-for="cat in channelCategories" :key="cat" class="group-label">{{ cat }}</div>
          <div v-for="ch in filteredChannels" :key="ch.pid" class="channel-item" :class="{ active: currentChannel?.pid===ch.pid }" @click="selectChannel(ch)">
            <span class="ch-num">{{ channels.findIndex(c => c.pid===ch.pid)+1 }}</span>
            <span class="ch-name">{{ ch.name }}</span>
            <i class="ri-star-line ch-fav-icon" :class="{ on: favs.includes(ch.pid) }" @click.stop="toggleFav(ch.pid)"></i>
            <span class="live-dot" :class="{ on: ch.live }"></span>
          </div>
        </template>
        <template v-else>
          <div v-if="!filteredChannels.length" class="panel-empty">暂无收藏频道<br><span style="font-size:11px">点击频道行的 ☆ 即可收藏</span></div>
          <div v-for="ch in filteredChannels" :key="ch.pid" class="channel-item" :class="{ active: currentChannel?.pid===ch.pid }" @click="selectChannel(ch)">
            <span class="ch-num">{{ channels.findIndex(c => c.pid===ch.pid)+1 }}</span>
            <span class="ch-name">{{ ch.name }}</span>
            <i class="ri-star-line ch-fav-icon" :class="{ on: favs.includes(ch.pid) }" @click.stop="toggleFav(ch.pid)"></i>
          </div>
        </template>
      </div>
    </transition>

    <!-- ── 节目单侧栏 ───────────────────────────────────────────── -->
    <transition name="slide">
      <div v-if="showEpg" id="lptv-epg" class="epg-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">节目单</span>
          <div class="epg-subtitle">{{ currentChannel?.name || '--' }} · {{ epgDateLabelVal }}</div>
        </div>
        <div class="date-tabs">
          <div v-for="(d,i) in epgDates" :key="i" class="date-tab" :class="{ active: d.active }" @click="selectEpgDate(d)">
            <span class="date-tab-label">{{ d.label }}</span>
            <span v-if="d.sub" class="date-tab-sub">{{ d.sub }}</span>
          </div>
        </div>
        <div class="epg-divider"></div>
        <div v-if="epgLoading" class="epg-loading">加载中…</div>
        <div v-else-if="!epgPrograms.length" class="epg-empty">暂无节目数据</div>
        <div v-else class="program-list">
          <div v-for="(p,i) in epgPrograms" :key="i" class="program-item" :class="{ current: p.current }">
            <span class="prog-time">{{ p.start }}-{{ p.end }}</span>
            <span class="prog-name">{{ p.name }}</span>
            <button v-if="p.s0" class="res-btn" :class="{ active: p.reserved }" @click="toggleRes(p)">{{ p.reserved ? '已约' : '预约' }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ── 设置面板 ─────────────────────────────────────────────── -->
    <transition name="slide">
      <div v-if="showSettings" id="lptv-settings" class="settings-panel">
        <div class="settings-card glass-card">
          <div class="settings-title-row">
            <span class="settings-title">设置</span>
            <button class="btn btn--close" @click="showSettings=false"><i class="ri-close-line"></i></button>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-row setting-row--check" @click="resumeLast=!resumeLast; LptvState.flush({resumeLast})">
            <div class="checkbox-wrap" :class="{ checked: resumeLast }"><i class="ri-check-line"></i></div>
            <span>启动时恢复上次频道</span>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-row setting-row--select">
            <span>画面模式</span>
            <div class="select-wrap">
              <select v-model="settings.fit" class="select-el">
                <option value="contain">完整画面（黑边）</option>
                <option value="cover">铺满（裁剪）</option>
              </select>
              <i class="ri-arrow-down-s-line"></i>
            </div>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-section">
            <div class="setting-row setting-row--dir">
              <span>录制</span>
              <div class="dir-actions">
                <button class="btn btn--pill btn--blue-sm" @click="openDir(settings.recDir)">更改</button>
                <button class="btn btn--pill btn--ghost-sm" @click="openDir(settings.recDir)">打开</button>
              </div>
            </div>
            <div class="dir-path">{{ settings.recDir }}</div>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-section">
            <div class="setting-row setting-row--dir">
              <span>截图</span>
              <div class="dir-actions">
                <button class="btn btn--pill btn--blue-sm" @click="openDir(settings.shotDir)">更改</button>
                <button class="btn btn--pill btn--ghost-sm" @click="openDir(settings.shotDir)">打开</button>
              </div>
            </div>
            <div class="dir-path">{{ settings.shotDir }}</div>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-row setting-row--keys">
            <span>快捷键</span>
            <div class="keys-hint">
              <div>↑↓ 切台 · ←→ 音量 · 空格 播放</div>
              <div>数字选台 · S 频道 · E 节目单 · M 静音</div>
              <div>R 录制 · X 截图 · F11 全屏</div>
            </div>
          </div>
          <div class="settings-divider"></div>
          <div class="setting-row setting-row--about" @click="showAbout=true; showSettings=false">
            <span>关于应用</span>
            <div class="about-link"><span>关于</span><i class="ri-arrow-right-s-line"></i></div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ── 关于弹窗 ─────────────────────────────────────────────── -->
    <transition name="fade">
      <div v-if="showAbout" class="about-overlay" @click.self="showAbout=false">
        <div class="about-card">
          <span class="about-x" @click="showAbout=false">✕</span>
          <div class="about-app">
            <div class="about-logo">LP</div>
            <div>
              <div class="about-appname">LPTV</div>
              <div class="about-ver">LPTV v1.0.0<br>@2026 powered by LightOS</div>
            </div>
          </div>
          <div class="about-desc">
            央视频官方直播源 · Web 端复刻<br>
            薄同源代理架构 · 毛玻璃极简界面 · 频道收藏 · 节目单预约 · 录制截图
          </div>
          <div class="about-brand">
            <div class="about-brandname">LPTV</div>
            <div class="about-slogan">AI 编程时代 · 行者</div>
            <div class="about-quote">一 个 人 的 文 字 长 征。</div>
          </div>
          <div class="about-foot">LPTV · @2026 powered by LightOS</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app-root { width: 100%; height: 100%; position: relative; display: flex; overflow: hidden; background: #06080d; font-family: "Source Han Sans SC", "Microsoft YaHei", system-ui, sans-serif; }
.app-root.dev-hidden { display: none; }
#lptv-video-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: none; z-index: 1; background: #000; }
#lptv-loader { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: #06080d; flex-direction: column; gap: 16px; }
#lptv-loader .spinner { width: 46px; height: 46px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: #4f7cff; animation: lptvmaskspin .8s linear infinite; }
#lptv-loader .label { color: #6b7fae; font-size: 13px; letter-spacing: 1px; }
@keyframes lptvmaskspin { to { transform: rotate(360deg); } }
#lptv-error { position: fixed; inset: 0; z-index: 9998; display: none; align-items: center; justify-content: center; background: #06080d; flex-direction: column; gap: 12px; color: #c7d3ed; }
#lptv-error.show { display: flex; }
#lptv-error h2 { color: #ff4d5e; font-size: 18px; }
#lptv-error p { font-size: 13px; color: #6b7fae; max-width: 400px; text-align: center; line-height: 1.7; }
#lptv-error button { margin-top: 8px; padding: 8px 20px; border-radius: 8px; background: rgba(79,124,255,.3); border: 1px solid rgba(79,124,255,.5); color: #fff; cursor: pointer; font-size: 13px; }
.shot-flash { position: fixed; inset: 0; background: #fff; opacity: 0; z-index: 2147483005; pointer-events: none; }
.shot-flash.go { animation: lptvflash .35s ease-out; }
@keyframes lptvflash { 0%{opacity:.85}100%{opacity:0} }
.osd-tip { position: absolute; left: 40px; top: 40px; z-index: 10; pointer-events: none; background: linear-gradient(90deg, rgba(10,16,32,.65), rgba(10,16,32,.2) 55%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(120,160,255,.16); border-radius: 14px; padding: 14px 22px 16px; max-width: 70vw; }
.osd-num { font-size: 52px; font-weight: 800; line-height: 1; color: #4f7cff; text-shadow: 0 2px 18px rgba(0,0,0,.85); }
.osd-name { font-size: 26px; font-weight: 600; margin-top: 6px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,.85); }
.osd-sub { font-size: 14px; color: #9db4e8; margin-top: 6px; letter-spacing: 1px; }
.vol-tip { position: absolute; right: 40px; top: 110px; z-index: 10; pointer-events: none; display: flex; align-items: center; gap: 10px; background: rgba(10,16,32,.75); backdrop-filter: blur(10px); border: 1px solid rgba(120,160,255,.18); border-radius: 10px; padding: 8px 14px; }
.vol-bar-wrap { width: 4px; height: 60px; background: rgba(255,255,255,.18); border-radius: 2px; position: relative; overflow: hidden; }
.vol-bar { position: absolute; bottom: 0; left: 0; right: 0; background: #4f7cff; border-radius: 2px; transition: height .15s; }
.vol-val { font-size: 13px; color: #7d9bff; font-family: Consolas, monospace; }
.lptv-toast { position: absolute; left: 50%; top: 72px; transform: translateX(-50%); z-index: 9; background: rgba(20,28,48,.96); color: #e8eefc; padding: 10px 22px; border-radius: 9px; font-size: 13px; border: 1px solid rgba(80,120,255,.25); white-space: nowrap; max-width: 72vw; overflow: hidden; text-overflow: ellipsis; }
.channel-logo { position: absolute; top: 48px; left: 40px; z-index: 10; pointer-events: none; }
.logo-main { display: flex; align-items: center; }
.logo-text { font-size: 34px; font-weight: 800; color: #fff; letter-spacing: 1px; line-height: 1; }
.logo-num-badge { width: 44px; height: 44px; border-radius: 999px; border: 2.7px solid rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; margin-left: 8px; font-size: 22px; font-weight: 700; color: #fff; line-height: 1; }
.logo-underline { width: 151px; height: 3px; background: rgba(255,255,255,1); border-radius: 999px; margin-top: 8px; }
.logo-name { margin-top: 8px; font-size: 24px; font-weight: 700; color: #fff; width: 150px; text-align: center; }
.rec-badge { position: absolute; left: 40px; bottom: 34px; z-index: 11; display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 9px; background: rgba(20,28,48,.82); backdrop-filter: blur(14px); border: 1px solid rgba(255,77,94,.4); box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.rec-dot { width: 9px; height: 9px; border-radius: 50%; background: #ff4d5e; box-shadow: 0 0 8px #ff4d5e; animation: lptvrec 1.2s ease-in-out infinite; }
@keyframes lptvrec { 0%,100%{opacity:1}50%{opacity:.25} }
.rec-time { font-size: 12px; font-weight: 600; color: #ffb3bb; font-family: Consolas, monospace; letter-spacing: 1px; }
.ctrl-slide-enter-active, .ctrl-slide-leave-active { transition: transform 0.3s ease, opacity 0.25s ease; }
.ctrl-slide-enter-from, .ctrl-slide-leave-to { transform: translateX(-50%) translateY(100px); opacity: 0; }
.control-bar { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 20; width: 900px; max-width: calc(100% - 80px); }
.control-strip { border-radius: 30px; padding: 14px 26px 12px; box-shadow: 0 18px 50px rgba(0,0,0,0.55); position: relative; overflow: hidden; }
.highlight-line { width: 201px; height: 1px; background: rgba(255,255,255,0.45); border-radius: 999px; margin: 0 auto; }
.ctrl-row { display: flex; align-items: center; }
.ctrl-row--1 { padding-top: 12px; }
.ctrl-row--2 { padding-top: 14px; }
.ctrl-divider { width: 100%; height: 1px; background: rgba(255,255,255,0.09); margin: 0; }
.btn { border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; background: transparent; color: inherit; font-family: inherit; }
.btn--circle { width: 44px; height: 44px; border-radius: 999px; border: 0.7px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); }
.btn--circle:hover { background: rgba(255,255,255,0.14); }
.btn--circle i { font-size: 17px; color: rgba(226,232,240,1); }
.btn--play { width: 50px; height: 50px; border-radius: 999px; background: rgba(59,110,246,1); box-shadow: 0 6px 22px rgba(59,110,246,0.55); }
.btn--play i { font-size: 22px; color: #fff; }
.btn--play:hover { background: rgba(68,120,255,1); }
.btn--rec { background: rgba(239,68,68,1) !important; box-shadow: 0 6px 20px rgba(239,68,68,0.5) !important; border-color: rgba(255,255,255,0.24) !important; }
.btn--rec i { color: #fff !important; font-size: 19px; }
.play-btn-wrap { padding: 0 12px; }
.play-status { display: flex; align-items: center; margin-left: 24px; padding-right: 24px; border-right: 1px solid rgba(120,160,255,0.16); }
.live-dot { width: 9px; height: 8px; border-radius: 999px; background: rgba(239,68,68,1); flex-shrink: 0; }
.status-chname { font-size: 14px; font-weight: 600; color: rgba(241,245,249,1); padding-left: 10px; }
.status-sep { font-size: 13px; color: rgba(100,116,139,1); padding: 0 8px; }
.status-prog { font-size: 13px; color: rgba(148,163,184,1); padding-left: 8px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.volume-group { display: flex; align-items: center; margin-left: 20px; padding-right: 20px; border-right: 1px solid rgba(120,160,255,0.16); }
.vol-btn i { font-size: 16px; }
.volume-slider-wrap { position: relative; width: 140px; height: 28px; display: flex; align-items: center; padding-left: 12px; margin-left: 12px; }
.volume-track { position: relative; width: 100%; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.18); overflow: visible; }
.volume-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 999px; background: rgba(59,110,246,1); transition: width 0.1s; }
.volume-knob { position: absolute; top: 50%; width: 14px; height: 13px; border-radius: 999px; background: #fff; transform: translateY(-50%); pointer-events: none; }
.volume-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; margin: 0; }
.volume-num { font-size: 13px; font-weight: 500; color: rgba(203,213,225,1); padding-left: 12px; min-width: 24px; }
.rec-shot-group { display: flex; align-items: center; margin-left: 20px; }
.ctrl-row--2 { justify-content: center; gap: 14px; }
.btn--pill { height: 38px; padding: 0 22px; border-radius: 999px; border: 0.7px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.1); }
.btn--pill span { font-size: 14px; font-weight: 500; color: rgba(226,232,240,1); }
.btn--pill:hover { background: rgba(255,255,255,0.16); }
.btn--active { background: rgba(59,110,246,0.85) !important; border-color: rgba(59,110,246,0.9) !important; box-shadow: 0 6px 18px rgba(59,110,246,0.4); }
.btn--active span { color: #fff !important; }
.btn--active-blue { background: rgba(59,110,246,0.85) !important; border-color: rgba(59,110,246,0.9) !important; box-shadow: 0 6px 18px rgba(59,110,246,0.4); }
.btn--active-blue i { color: #fff !important; font-size: 18px !important; }
.btn--blue-sm { height: 30px; padding: 0 14px; border-radius: 999px; border: 0.7px solid rgba(59,110,246,0.4); background: rgba(59,110,246,0.16); font-size: 12px; font-weight: 500; color: rgba(143,180,255,1); }
.btn--ghost-sm { height: 30px; padding: 0 14px; border-radius: 999px; border: 0.7px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); font-size: 12px; font-weight: 500; color: rgba(203,213,225,1); }
.btn--ghost { border: 0.7px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); }
.btn--close { width: 30px; height: 30px; border-radius: 999px; background: rgba(255,255,255,0.06); }
.btn--close i { font-size: 16px; color: rgba(148,163,184,1); }
.btn--close:hover { background: rgba(255,77,94,0.2); }
.btn--close:hover i { color: rgba(255,143,154,1); }
.channel-sidebar, .epg-sidebar { width: 402px; height: 100%; background: rgba(12,17,27,0.82); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border-left: 1px solid rgba(120,160,255,0.10); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; z-index: 15; position: relative; }
.sidebar-header { padding: 20px 20px 0; flex-shrink: 0; }
.sidebar-title { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 2px; }
.epg-subtitle { font-size: 13px; color: rgba(148,163,184,1); margin-top: 4px; letter-spacing: 0.5px; }
.current-ch-card { margin: 16px 16px 0; padding: 14px 16px; border-radius: 14px; background: rgba(59,110,246,0.18); display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.current-ch-num { font-size: 26px; font-weight: 800; color: rgba(59,110,246,1); font-family: Consolas, monospace; min-width: 53px; }
.current-ch-name { font-size: 15px; font-weight: 700; color: #fff; }
.current-ch-sub { font-size: 12px; color: rgba(125,155,255,1); margin-top: 2px; }
.filter-tabs { display: flex; gap: 8px; padding: 16px 16px 0; flex-shrink: 0; }
.filter-tab { height: 32px; padding: 0 16px; border-radius: 999px; border: 0.7px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
.filter-tab span { font-size: 13px; color: rgba(143,163,204,1); }
.filter-tab.active { background: rgba(59,110,246,1); border-color: rgba(59,110,246,1); }
.filter-tab.active span { color: #fff; }
.group-label { font-size: 12px; color: rgba(92,113,158,1); padding: 16px 20px 6px; letter-spacing: 2px; flex-shrink: 0; }
.channel-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; margin: 2px 0; border-radius: 10px; cursor: pointer; transition: background 0.12s; height: 44px; }
.channel-item:hover { background: rgba(255,255,255,0.06); }
.channel-item.active { background: rgba(59,110,246,0.16); }
.ch-num { font-size: 12px; color: rgba(107,127,174,1); font-family: Consolas, monospace; min-width: 33px; flex-shrink: 0; }
.channel-item.active .ch-num { color: rgba(157,180,232,1); }
.ch-name { flex: 1; font-size: 13px; color: rgba(199,211,237,1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.channel-item.active .ch-name { color: #fff; font-weight: 600; }
.ch-fav-icon { font-size: 14px; color: rgba(100,116,139,1); flex-shrink: 0; cursor: pointer; transition: color 0.12s; }
.ch-fav-icon:hover { color: rgba(255,209,102,1); }
.ch-fav-icon.on { color: rgba(255,209,102,1); }
.live-dot { width: 7px; height: 6px; border-radius: 999px; background: rgba(71,85,105,1); flex-shrink: 0; }
.live-dot.on { background: rgba(239,68,68,1); box-shadow: 0 0 6px rgba(239,68,68,0.6); }
.panel-empty { padding: 30px 20px; text-align: center; color: #6b7fae; font-size: 13px; line-height: 1.7; }
.date-tabs { display: flex; gap: 6px; padding: 14px 16px 0; flex-shrink: 0; }
.date-tab { width: 74px; height: 56px; border-radius: 12px; background: rgba(255,255,255,0.06); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; transition: all 0.15s; }
.date-tab.active { background: rgba(59,110,246,1); }
.date-tab-label { font-size: 14px; font-weight: 500; color: rgba(143,163,204,1); }
.date-tab.active .date-tab-label { color: #fff; }
.date-tab-sub { font-size: 11px; color: rgba(92,113,158,1); }
.date-tab.active .date-tab-sub { color: rgba(180,200,255,0.8); }
.epg-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 12px 16px 0; flex-shrink: 0; }
.epg-loading, .epg-empty { padding: 30px 20px; text-align: center; color: #6b7fae; font-size: 13px; flex: 1; display: flex; align-items: center; justify-content: center; }
.program-list { flex: 1; overflow-y: auto; padding: 8px 8px 16px; }
.program-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin: 2px 0; border-radius: 10px; height: 42px; transition: background 0.12s; }
.program-item:hover { background: rgba(255,255,255,0.04); }
.program-item.current { background: rgba(239,68,68,0.16); }
.prog-time { font-size: 12px; color: rgba(107,127,174,1); font-family: Consolas, monospace; min-width: 97px; flex-shrink: 0; }
.program-item.current .prog-time { color: rgba(255,154,168,1); }
.prog-name { flex: 1; font-size: 13px; color: rgba(199,211,237,1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.program-item.current .prog-name { color: #fff; font-weight: 600; }
.res-btn { flex-shrink: 0; height: 26px; padding: 0 10px; border-radius: 7px; border: 0.7px solid rgba(59,110,246,0.3); background: rgba(59,110,246,0.16); font-size: 11px; font-weight: 500; color: rgba(125,155,255,1); cursor: pointer; transition: all 0.12s; letter-spacing: 1px; }
.res-btn:hover { background: rgba(59,110,246,0.3); color: #fff; }
.res-btn.active { background: rgba(255,170,80,0.2); border-color: rgba(255,170,80,0.45); color: rgba(255,179,107,1); }
.settings-panel { width: 430px; height: 100%; padding: 0 30px 0 0; display: flex; align-items: center; flex-shrink: 0; z-index: 15; position: relative; }
.settings-card { width: 400px; border-radius: 22px; padding: 20px 22px 18px; display: flex; flex-direction: column; max-height: 100%; overflow-y: auto; }
.settings-title-row { display: flex; align-items: center; justify-content: space-between; }
.settings-title { font-size: 19px; font-weight: 700; color: #fff; letter-spacing: 2px; }
.settings-divider { width: 100%; height: 1px; background: rgba(255,255,255,0.09); margin: 14px 0; }
.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
.setting-row span { font-size: 14px; color: rgba(226,232,240,1); }
.setting-row--check { cursor: pointer; }
.checkbox-wrap { width: 18px; height: 18px; border-radius: 5px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
.checkbox-wrap.checked { background: rgba(59,110,246,1); }
.checkbox-wrap i { font-size: 14px; color: rgba(148,163,184,1); }
.checkbox-wrap.checked i { color: #fff; }
.setting-row--select { align-items: center; }
.select-wrap { position: relative; width: 176px; height: 36px; border-radius: 10px; border: 0.7px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 12px; }
.select-el { background: transparent; border: none; outline: none; font-size: 13px; color: rgba(219,227,238,1); font-family: inherit; width: 100%; cursor: pointer; appearance: none; }
.select-wrap i { position: absolute; right: 10px; font-size: 16px; color: rgba(148,163,184,1); pointer-events: none; }
.setting-row--dir { justify-content: space-between; }
.dir-actions { display: flex; gap: 8px; }
.setting-section { padding: 8px 0 4px; }
.dir-path { font-size: 11px; color: rgba(100,116,139,1); padding-top: 8px; word-break: break-all; line-height: 1.5; }
.setting-row--keys { align-items: flex-start; }
.keys-hint { flex: 1; text-align: right; }
.keys-hint div { font-size: 11px; color: rgba(148,163,184,1); line-height: 1.7; }
.setting-row--about { cursor: pointer; }
.about-link { display: flex; align-items: center; gap: 4px; }
.about-link span { font-size: 13px; color: rgba(148,163,184,1); }
.about-link i { font-size: 16px; color: rgba(100,116,139,1); }
.about-overlay { position: fixed; inset: 0; z-index: 2147483005; display: flex; align-items: center; justify-content: center; background: rgba(5,9,20,.6); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3); }
.about-card { position: relative; width: 420px; max-width: 92vw; background: rgba(14,20,36,.92); backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5); border-radius: 16px; border: 1px solid rgba(120,160,255,.16); padding: 28px 30px 22px; box-shadow: 0 24px 80px rgba(0,0,0,.65); color: #c7d3ed; animation: lptvaboutin .22s ease; }
@keyframes lptvaboutin { from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none} }
.about-x { position: absolute; top: 14px; right: 16px; width: 28px; height: 28px; line-height: 26px; text-align: center; border-radius: 8px; color: #8fa3cc; font-size: 15px; cursor: pointer; transition: all .12s; }
.about-x:hover { background: rgba(255,77,94,.22); color: #ff8f9a; }
.about-app { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.about-logo { width: 52px; height: 52px; border-radius: 13px; flex-shrink: 0; background: linear-gradient(135deg, #4f7cff, #7c4dff); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff; }
.about-appname { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 2px; }
.about-ver { font-size: 11px; color: #6b7fae; margin-top: 3px; font-family: Consolas, monospace; }
.about-desc { font-size: 12px; color: #9db4e8; line-height: 1.9; margin: 0 0 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(120,160,255,.1); }
.about-brand { border: 1px solid rgba(120,160,255,.16); border-radius: 12px; padding: 15px 16px; background: rgba(79,124,255,.06); margin-bottom: 14px; }
.about-brandname { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: 2px; }
.about-slogan { font-size: 11px; color: #7d9bff; letter-spacing: 1px; margin-top: 3px; }
.about-quote { font-size: 12px; color: #c7d3ed; line-height: 1.8; margin-top: 9px; }
.about-foot { text-align: center; font-size: 11px; color: #5c719e; margin-top: 14px; letter-spacing: 1px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.3s ease, opacity 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(20px); opacity: 0; }
</style>
