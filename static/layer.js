/* LPTV Web — 主逻辑层 (路线 A, 同源代理)
 *
 * 与原生 inject.js 的主要差异:
 *   - window.pywebview.api → LxApi
 *   - pyStatePush → LxState.flush
 *   - 无 OS 窗口能力 (置顶/拖拽/最大化)
 *   - 视频源来自代理的 /proxy-video (同源, canvas 不污染)
 */

;(function () {
  if (window.__lptvCctvWeb) return;
  window.__lptvCctvWeb = true;

  const LS_KEY = "lptv.cfg.v3";
  const RES_KEY = "lptv.res.v1";

  const DEFAULT_CFG = {
    volume: 1,
    muted: false,
    maxQuality: true,
    fit: "contain",
    blackRecovery: true,
    autoHide: 3500,
    resumeLast: true,
    favs: [],
  };

  const Lptv= window.__lptvCctvWeb = {
    playUrl: "",
    currentPid: "",
    channels: [],
    video: null,
    currentHls: null,
    darkCount: 0,
    digits: "",
    devHidden: false,
    _lastLoad: 0,
    _loadedPid: "",
    _autoplayPending: false,
    _panelIn: false,
    _panelHideT: null,
    _panelArmed: true,
    _epgIn: false,
    _epgHideT: null,
    _epgArmed: true,
    epg: { cache: {} },
    _dbg: [],
    ui: {},
  };

  let cfg = loadCfg();

  /* ── 工具 ─────────────────────────────────────────────────────── */

  function loadCfg() {
    try {
      return Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem(LS_KEY) || "{}"));
    } catch { return Object.assign({}, DEFAULT_CFG); }
  }
  function saveCfg() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {}
  }

  function el(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    return e;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dbg(s) {
    Lptv._dbg.push(((new Date()).getTime() % 100000) + " " + s);
    if (Lptv._dbg.length > 30) Lptv._dbg.shift();
  }

  function pyStatePush(patch) { LxState.flush(patch); }

  function favHas(pid) { return (cfg.favs || []).indexOf(pid) >= 0; }
  function favToggle(pid) {
    if (!pid) return false;
    cfg.favs = cfg.favs || [];
    const i = cfg.favs.indexOf(pid);
    if (i >= 0) cfg.favs.splice(i, 1);
    else cfg.favs.push(pid);
    saveCfg();
    pyStatePush({ favs: cfg.favs });
    return i < 0;
  }

  /* ── EPG protobuf 解析 ─────────────────────────────────────────── */

  function utf8Bytes(bytes, a, n) {
    try {
      if (window.TextDecoder) return new TextDecoder().decode(bytes.subarray(a, a + n));
    } catch {}
    try {
      let s = "";
      for (let i = a; i < a + n; i++) s += String.fromCharCode(bytes[i]);
      return decodeURIComponent(escape(s));
    } catch { return ""; }
  }

  function parseEpgEntry(bytes, a, b) {
    let i = a, p = {};
    function vi() {
      let v = 0, s = 0, k = 0;
      while (i < b && k < 5) {
        const x = bytes[i++];
        v += (x & 0x7f) * (1 << s);
        s += 7; k++;
        if (!(x & 0x80)) break;
      }
      return v;
    }
    try {
      while (i < b) {
        const tag = vi();
        if (tag === 0) break;
        const f = tag >>> 3, wt = tag & 7;
        if (wt === 2) {
          const len = vi();
          if (i + len > b) break;
          if (f === 1) p.id = utf8Bytes(bytes, i, len);
          else if (f === 2) p.name = utf8Bytes(bytes, i, len);
          else if (f === 5) p.start = utf8Bytes(bytes, i, len);
          else if (f === 6) p.end = utf8Bytes(bytes, i, len);
          else if (f === 9 || f === 10) p.extra = utf8Bytes(bytes, i, len);
          i += len;
        } else if (wt === 0) {
          const v = vi();
          if (f === 3) p.s0 = v;
          else if (f === 4) p.e0 = v;
          else if (f === 7) p.dur = v;
        } else { i += vi(); }
      }
    } catch {}
    return p.name ? p : null;
  }

  function parseEpg(buf) {
    const programs = [];
    try {
      const bytes = new Uint8Array(buf);
      let i = 0;
      function vi() {
        let v = 0, s = 0, k = 0;
        while (i < bytes.length && k < 5) {
          const b = bytes[i++];
          v += (b & 0x7f) * (1 << s);
          s += 7; k++;
          if (!(b & 0x80)) break;
        }
        return v;
      }
      while (i < bytes.length) {
        const tag = vi();
        if (tag === 0) break;
        const f = tag >>> 3, wt = tag & 7;
        if (wt === 2) {
          const len = vi();
          const p = parseEpgEntry(bytes, i, i + len);
          if (p) programs.push(p);
          i += len;
        } else if (wt === 0) { vi(); }
        else { i += vi(); }
        if (programs.length > 200) break;
      }
    } catch {}
    return programs;
  }

  function ymdStr(dt) {
    return dt.getFullYear() +
      String(dt.getMonth() + 1).padStart(2, "0") +
      String(dt.getDate()).padStart(2, "0");
  }
  function epgDateLabel(dt) {
    return (dt.getMonth() + 1) + "月" + dt.getDate() + "日 星期" +
      ["日","一","二","三","四","五","六"][dt.getDay()];
  }
  function epgYmdOf(off) {
    const d = new Date();
    d.setDate(d.getDate() + (off || 0));
    return ymdStr(d);
  }

  /* ── 频道逻辑 ──────────────────────────────────────────────────── */

  function chNameOf(pid) {
    const ch = Lptv.channels.find(c => c.pid === pid);
    return ch ? ch.name : (pid ? "频道 " + pid : "");
  }
  function officialNameOf(pid) {
    const ch = Lptv.channels.find(c => c.pid === pid);
    return ch ? ch.official : "";
  }
  function chNumLabel() {
    const idx = Lptv.channels.findIndex(c => c.pid === Lptv.currentPid);
    return idx >= 0 ? String(idx + 1).padStart(2, "0") : "--";
  }

  function isPayChannel(t) { return /限免|VIP/.test(t); }
  function inferCategory(t) {
    if (/^CGTN/.test(t)) return "CGTN";
    if (/^CCTV/.test(t) || /4K|8K/.test(t)) return "央视";
    if (/教育/.test(t)) return "其他";
    if (/卫视/.test(t)) return "卫视";
    return "地方";
  }

  /* ── UI 构建 ───────────────────────────────────────────────────── */

  function buildUI() {
    if (window.__LptvIframe) return; // iframe mode: parent handles UI
    const root = el("div", { id: "lptv-root" });

    // OSD
    const osd = el("div", { id: "lptv-osd", html:
      '<div class="lptv-osd-num"><b>00</b></div><div class="lptv-osd-name"></div><div class="lptv-osd-sub"></div>' });

    // Digit
    const digit = el("div", { id: "lptv-digit" });

    // Spinner
    const spinRoot = el("div", { id: "lptv-spin" });

    // Volume
    const vol = el("div", { id: "lptv-vol", html:
      '<div class="lptv-vol-label">音量 <span id="lptv-vol-num">100</span>%</div>' });
    const range = el("input", { id: "lptv-vol-range", type: "range", min: "0", max: "100" });
    range.value = Math.round(cfg.volume * 100);
    vol.appendChild(range);

    // Controls bar
    const controls = el("div", { id: "lptv-controls", html:
      '<div class="lptv-ctl-seg lptv-ctl-nav">' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-prev" title="上一台 (↑)"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M18 5l-9 7 9 7z"/></svg></button>' +
        '<button class="lptv-btn lptv-btn-main" id="lptv-b-play" title="暂停/播放 (空格)"><svg id="lptv-b-play-ico" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-next" title="下一台 (↓)"><svg viewBox="0 0 24 24"><path d="M6 5l9 7-9 7z"/><rect x="16.5" y="5" width="2.5" height="14" rx="1"/></svg></button>' +
      '</div>' +
      '<div class="lptv-ctl-seg lptv-ctl-now" id="lptv-ctl-now">' +
        '<span class="lptv-now-dot"></span>' +
        '<span class="lptv-chlabel" id="lptv-chlabel"></span>' +
        '<span class="lptv-now-sep">·</span>' +
        '<span class="lptv-now-prog" id="lptv-now-prog">正在直播</span>' +
      '</div>' +
      '<div class="lptv-ctl-seg lptv-ctl-vol">' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-mute" title="静音 (M)"><svg id="lptv-b-mute-ico" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="lptv-waves" d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke-width="1.8" stroke-linecap="round"/><path class="lptv-mute-x" d="M16 9l6 6M22 9l-6 6" fill="none" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
        '<input id="lptv-c-vol" type="range" min="0" max="100" />' +
        '<span class="lptv-vol-txt" id="lptv-c-vol-txt">100</span>' +
      '</div>' +
      '<div class="lptv-ctl-seg">' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-rec" title="录制节目 (R)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/></svg></button>' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-shot" title="截图 (X)"><svg viewBox="0 0 24 24"><path d="M5 7h2l1.5-2h7L17 7h2a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1zm7 3a4 4 0 100 8 4 4 0 000-8z" fill="none" stroke-width="1.6"/><circle cx="12" cy="14" r="2.2"/></svg></button>' +
      '</div>' +
      '<div class="lptv-ctl-seg lptv-ctl-side">' +
        '<button class="lptv-btn lptv-btn-txt" id="lptv-b-epg" title="节目单 (E)">节目单</button>' +
        '<button class="lptv-btn lptv-btn-txt" id="lptv-b-panel" title="频道列表 (S)">频道</button>' +
        '<button class="lptv-btn lptv-btn-ico" id="lptv-b-set" title="设置"><svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L16 21h-4l-.4-2.6a7 7 0 01-2-1.2l-2.5 1-2-3.4 2-1.6A7 7 0 017 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.4 2.6a7 7 0 012 1.2l2.5-1 2 3.4-2 1.6c.1.4.1.8.1 1.2z" fill="none" stroke-width="1.6"/></svg></button>' +
      '</div>' });
    controls.querySelector("#lptv-c-vol").value = Math.round(cfg.volume * 100);

    // Next channel preview
    const nextch = el("div", { id: "lptv-nextch" });

    // Rec badge
    const recBadge = el("div", { id: "lptv-rec-badge", html:
      '<span class="lptv-rec-dot"></span><span id="lptv-rec-time">REC 00:00</span>' });

    // Channel panel
    const panel = el("div", { id: "lptv-panel", html:
      '<div class="lptv-panel-head"><span class="lptv-panel-title">频道列表</span></div>' +
      '<div class="lptv-panel-cur">' +
      '<span class="lptv-panel-cur-num">--</span>' +
      '<div><div class="lptv-panel-cur-name">--</div><div class="lptv-panel-cur-sub">正在直播</div></div>' +
      '</div>' +
      '<div id="lptv-panel-tabs"></div>' +
      '<div class="lptv-panel-body" id="lptv-panel-body"></div>' });

    // EPG panel
    const epg = el("div", { id: "lptv-epg", html:
      '<div class="lptv-epg-head">' +
      '<div><div class="lptv-epg-title">节目单</div>' +
      '<div class="lptv-epg-sub"><span id="lptv-epg-ch">--</span> · <span id="lptv-epg-date"></span></div></div></div>' +
      '<div id="lptv-epg-tabs"></div>' +
      '<div class="lptv-epg-body" id="lptv-epg-body"></div>' });
    const dLabel = epg.querySelector("#lptv-epg-date");
    if (dLabel) dLabel.textContent = epgDateLabel(new Date());

    // Settings
    const settings = el("div", { id: "lptv-settings", html:
      '<div class="lptv-set-title">设 置</div>' +
      '<div class="lptv-set-row"><label><input type="checkbox" id="lptv-s-resume" ' +
        (cfg.resumeLast !== false ? "checked" : "") + '>启动时恢复上次频道</label></div>' +
      '<div class="lptv-set-sep"></div>' +
      '<div class="lptv-set-row"><span>画面模式</span>' +
      '<select id="lptv-s-fit"><option value="contain" ' + (cfg.fit==="contain"?"selected":"") + '>完整画面（黑边）</option><option value="cover" ' + (cfg.fit==="cover"?"selected":"") + '>铺满（裁剪）</option></select></div>' +
      '<div class="lptv-set-sep"></div>' +
      '<div class="lptv-set-row"><span>录制保存</span><span class="lptv-set-url" id="lptv-s-recdir-val">./records/</span></div>' +
      '<div class="lptv-set-row"><span>截图保存</span><span class="lptv-set-url" id="lptv-s-shotdir-val">./shots/</span></div>' +
      '<div class="lptv-set-sep"></div>' +
      '<div class="lptv-set-row"><span>快捷键</span><span style="font-size:11px;color:#6b7fae">↑↓ 切台 · ←→ 音量 · 空格 播放<br>数字选台 · S 频道 · E 节目单 · M 静音<br>R 录制 · X 截图 · F11 全屏</span></div>' +
      '<div class="lptv-set-sep"></div>' +
      '<div class="lptv-set-row" id="lptv-s-about" style="cursor:pointer"><span>关于应用</span><span class="lptv-link">关于 ›</span></div>' +
      '</div>' });

    // About
    const about = el("div", { id: "lptv-about", html:
      '<div class="lptv-about-card">' +
        '<span class="lptv-about-x" id="lptv-about-x" title="关闭">✕</span>' +
        '<div class="lptv-about-app">' +
          '<div class="lptv-about-logo" style="background:linear-gradient(135deg,#4f7cff,#7c4dff);width:52px;height:52px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff"<div class="lptv-about-logo-text">LPTV</div>' +
          '<div><div class="lptv-about-appname">LPTV</div>' +
          '<div class="lptv-about-ver" id="lptv-about-ver">Web 版 v0.2.0</div></div>' +
        '</div>' +
        '<div class="lptv-about-desc">LPTV播放器</div>' +
        '<div class="lptv-about-brand">' +
          '<div class="lptv-about-brandname">LPTV</div>' +
          '<div class="lptv-about-slogan">AI 编程时代 · 行者</div>' +
          '<div class="lptv-about-quote">一 个 人 的 文 字 长 征。</div>' +
        '</div>' +
        '<div class="lptv-about-foot">Made for LCMD</div>' +
      '</div>' });

    // Toast / Hint / Flash
    const toastEl = el("div", { id: "lptv-toast" });
    const hint = el("div", { id: "lptv-hint" });
    const shotFlash = el("div", { id: "lptv-shot-flash" });
    const namePop = el("div", { id: "lptv-name-pop" });

    // Top bar
    const topbar = el("div", { id: "lptv-topbar" });
    topbar.innerHTML =
      '<span class="lptv-tb-title"><b>LPTV</b></span>' +
      '<span class="lptv-tb-meta"><span class="dot"></span><span id="lptv-tb-ch">--</span></span>' +
      '<span class="lptv-tb-sp" style="flex:1"></span>';
    topbar.classList.add("show");

    root.appendChild(osd);
    root.appendChild(digit);
    root.appendChild(spinRoot);
    root.appendChild(vol);
    root.appendChild(controls);
    root.appendChild(nextch);
    root.appendChild(recBadge);
    root.appendChild(panel);
    root.appendChild(epg);
    root.appendChild(settings);
    root.appendChild(about);
    root.appendChild(toastEl);
    root.appendChild(hint);
    root.appendChild(shotFlash);
    root.appendChild(namePop);
    root.appendChild(topbar);
    document.body.appendChild(root);
    // 确保 lptv-root 始终是 body 的最后一个子节点（防止官方页重排后失去顶层）
    function ensureRootOnTop() {
      if (document.body.lastChild !== root) {
        document.body.appendChild(root);
      }
    }
    ensureRootOnTop();
    // 监听 body 变化，官方页 SPA 重渲染时重新置顶
    try {
      new MutationObserver(function(mutations) {
        for (var m of mutations) {
          for (var node of m.addedNodes) {
            if (node.nodeType === 1) { ensureRootOnTop(); return; }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch(e) {}

    Lptv.ui = { root, osd, digit, vol, controls, nextch, panel, epg, settings, about,
              toast: toastEl, hint, topbar, volRange: range,
              volRange2: controls.querySelector("#lptv-c-vol"),
              chlabel: controls.querySelector("#lptv-chlabel"),
              spin: spinRoot };
  }

  /* ── OSD / Toast / Hint ────────────────────────────────────────── */

  function showOSD(num, text, sticky) {
    const o = Lptv.ui.osd;
    if (!o) return;
    o.querySelector(".lptv-osd-num").innerHTML = "<b>" + (num || "--") + "</b>";
    o.querySelector(".lptv-osd-name").textContent = chNameOf(Lptv.currentPid);
    o.querySelector(".lptv-osd-sub").textContent = text || "";
    o.classList.add("show");
    clearTimeout(o._t);
    if (!sticky) o._t = setTimeout(() => o.classList.remove("show"), 3000);
  }

  function showSpin(on) {
    if (Lptv.ui.spin) Lptv.ui.spin.style.display = on ? "block" : "none";
  }

  let hintTimer = null;
  function showHint(msg) {
    const h = Lptv.ui.hint;
    if (!h) return;
    h.textContent = msg;
    h.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => h.classList.remove("show"), 5000);
  }
  function hideHint() {
    if (Lptv.ui.hint) Lptv.ui.hint.classList.remove("show");
  }

  let toastTimer = null;
  function toast(msg) {
    const t = Lptv.ui.toast;
    if (!t) return;
    t.classList.remove("_res");
    t._res = null;
    clearTimeout(t._resT);
    clearTimeout(t._resJump);
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ── 频道面板 ──────────────────────────────────────────────────── */

  function chRowHtml(c) {
    const idx = Lptv.channels.indexOf(c) + 1;
    const faved = favHas(c.pid);
    return '<div class="lptv-ch' + (faved ? " faved" : "") + '" data-pid="' + c.pid + '">' +
      '<span class="lptv-ch-num">' + String(idx).padStart(2, "0") + "</span>" +
      '<span class="lptv-ch-name">' + c.name + '</span>' +
      '<span class="lptv-ch-fav' + (faved ? " on" : "") + '" data-pid="' + c.pid + '" title="' +
        (faved ? "取消收藏" : "收藏频道") + '">' + favStarSvg(faved) + '</span>' +
      '<span class="live-dot"></span></div>';
  }

  function favStarSvg(on) {
    return '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" ' +
      (on ? 'fill="currentColor" stroke="none"/>' : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>');
  }

  function renderPanel() {
    const body = Lptv.ui.panel.querySelector("#lptv-panel-body");
    const tabs = Lptv.ui.panel.querySelector("#lptv-panel-tabs");
    const filter = Lptv._panelFilter || "all";
    const favsOnly = filter === "fav";
    const groups = {};
    Lptv.channels.forEach(c => {
      if (favsOnly && !favHas(c.pid)) return;
      (groups[c.category] = groups[c.category] || []).push(c);
    });
    let html = "";
    if (favsOnly) {
      const favList = [];
      (cfg.favs || []).forEach(pid => {
        const c = Lptv.channels.find(x => x.pid === pid);
        if (c) favList.push(c);
      });
      html += '<div class="lptv-cat">我的收藏 · ' + favList.length + '</div>';
      if (!favList.length) {
        html += '<div class="lptv-panel-empty">暂无收藏频道<br><span style="font-size:11px">点击频道行的 ☆ 即可收藏</span></div>';
      }
      favList.forEach(c => { html += chRowHtml(c); });
    } else {
      const order = ["央视", "CGTN", "卫视", "地方", "其他"];
      order.forEach(cat => {
        if (!groups[cat]) return;
        const fav = [], nor = [];
        groups[cat].forEach(c => { (favHas(c.pid) ? fav : nor).push(c); });
        html += '<div class="lptv-cat">' + cat + "</div>";
        fav.forEach(c => { html += chRowHtml(c); });
        nor.forEach(c => { html += chRowHtml(c); });
      });
    }
    body.innerHTML = html;
    body.scrollTop = 0;
    if (tabs) renderPanelTabs();
    markActive();
  }

  function renderPanelTabs() {
    const tabs = Lptv.ui.panel.querySelector("#lptv-panel-tabs");
    if (!tabs) return;
    const cur = Lptv._panelFilter || "all";
    const favN = (cfg.favs || []).filter(pid => Lptv.channels.some(c => c.pid === pid)).length;
    tabs.innerHTML = '<span class="lptv-ptab' + (cur === "all" ? " on" : "") + '" data-f="all">全部</span>' +
      '<span class="lptv-ptab' + (cur === "fav" ? " on" : "") + '" data-f="fav">收藏' +
      (favN ? '<b>' + favN + '</b>' : "") + '</span>';
  }

  function updatePanelCur() {
    const panel = Lptv.ui.panel;
    if (!panel) return;
    const num = panel.querySelector(".lptv-panel-cur-num");
    const name = panel.querySelector(".lptv-panel-cur-name");
    if (!num || !name) return;
    const idx = Lptv.channels.findIndex(c => c.pid === Lptv.currentPid);
    num.textContent = idx >= 0 ? String(idx + 1).padStart(2, "0") : "--";
    name.textContent = chNameOf(Lptv.currentPid) || "--";
  }

  /* ── 频道切换 ──────────────────────────────────────────────────── */

  async function switchChannel(pid) {
    if (!pid) return;
    if (pid !== Lptv.currentPid) {
      Lptv._pidBefore = Lptv.currentPid;
      Lptv._switchAt = Date.now();
    }
    Lptv.currentPid = pid;
    if (/^\d+$/.test(String(pid))) {
      cfg.lastPid = pid;
      saveCfg();
      pyStatePush({ lastPid: pid });
    }
    markActive();
    epgSync();
    showOSD(chNumLabel(), chNameOf(pid) + " · 正在加载…", true);
    showSpin(true);

    // Web 端: 通过代理跳转到官方播放页 (带 pid 参数)
    const proxyBase = window.__LptvProxyBase || "http://localhost:9100";
    try {
      const target = proxyBase + "/_page?pid=" + pid;
      // 在同源 iframe 中加载, 或直接导航
      // 这里采用直接导航到官方页 + 代理的方式
      if (window.__LptvIframe) {
        window.parent.postMessage({ type: 'lptv-switch-channel', pid: pid, name: chNameOf(pid) }, '*');
      } else {
        window.location.href = (window.__LptvProxyBase || 'http://localhost:9100') + '/_page?pid=' + pid;
      }
    } catch (e) {
      showSpin(false);
      toast("频道切换失败: " + e);
    }
  }

  function stepChannel(delta) {
    if (!Lptv.channels.length) return;
    const idx = Lptv.channels.findIndex(c => c.pid === Lptv.currentPid);
    const next = (idx < 0 ? 0 : idx + delta + Lptv.channels.length) % Lptv.channels.length;
    switchChannel(Lptv.channels[next].pid);
    showNextCh(delta);
  }

  function showNextCh(dir) {
    const p = Lptv.ui.nextch;
    if (!p || !Lptv.channels.length) return;
    const idx = Lptv.channels.findIndex(c => c.pid === Lptv.currentPid);
    if (idx < 0) return;
    const prev = Lptv.channels[(idx - 1 + Lptv.channels.length) % Lptv.channels.length];
    const next = Lptv.channels[(idx + 1) % Lptv.channels.length];
    const prevNo = idx === 0 ? Lptv.channels.length : idx;
    const nextNo = (idx + 1) % Lptv.channels.length + 1;
    p.innerHTML =
      '<div class="lptv-nc-row' + (dir > 0 ? "" : " hl") + '"><span class="lptv-nc-arrow">▲</span>' +
        '<span class="lptv-nc-num">' + prevNo + '</span><span class="lptv-nc-name">' + prev.name + '</span></div>' +
      '<div class="lptv-nc-sep"></div>' +
      '<div class="lptv-nc-row' + (dir > 0 ? " hl" : "") + '"><span class="lptv-nc-arrow">▼</span>' +
        '<span class="lptv-nc-num">' + nextNo + '</span><span class="lptv-nc-name">' + next.name + '</span></div>';
    p.classList.add("show");
    clearTimeout(p._t);
    p._t = setTimeout(() => p.classList.remove("show"), 2000);
  }

  function markActive() {
    document.querySelectorAll(".lptv-ch").forEach(el2 => {
      el2.classList.toggle("active", el2.dataset.pid === Lptv.currentPid);
    });
    updatePanelCur();
    updateTopbarCh();
    setChLabel();
  }
  function updateTopbarCh() {
    const ch = document.getElementById("lptv-tb-ch");
    if (!ch) return;
    const cur = Lptv.channels.find(c => c.pid === Lptv.currentPid);
    ch.textContent = (Lptv.currentPid && cur) ? cur.name : (Lptv.currentPid ? chNameOf(Lptv.currentPid) : "未连接");
  }

  /* ── 设置 ──────────────────────────────────────────────────────── */

  function syncFit() {
    const sel = document.getElementById("lptv-s-fit");
    if (sel) sel.value = cfg.fit;
  }
  function setChLabel() {
    if (Lptv.ui.chlabel) Lptv.ui.chlabel.textContent = chNameOf(Lptv.currentPid);
    updateNowProg();
  }

  /* ── 音量 ──────────────────────────────────────────────────────── */

  function setVolume(v) {
    v = clamp(v, 0, 1);
    cfg.volume = v;
    cfg.muted = false;
    if (Lptv.video) { Lptv.video.volume = v; Lptv.video.muted = false; }
    if (Lptv.ui.volRange) Lptv.ui.volRange.value = Math.round(v * 100);
    if (Lptv.ui.volRange2) Lptv.ui.volRange2.value = Math.round(v * 100);
    syncMuteBtn();
    saveCfg();
    const vn = document.getElementById("lptv-vol-num");
    if (vn) vn.textContent = Math.round(v * 100);
    const vt = document.getElementById("lptv-c-vol-txt");
    if (vt) vt.textContent = Math.round(v * 100);
    Lptv.ui.vol.classList.add("show");
    clearTimeout(Lptv.ui.vol._t);
    Lptv.ui.vol._t = setTimeout(() => Lptv.ui.vol.classList.remove("show"), 1600);
  }

  function toggleMute() {
    cfg.muted = !cfg.muted;
    if (Lptv.video) Lptv.video.muted = cfg.muted;
    if (!cfg.muted && cfg.volume === 0) setVolume(0.6);
    syncMuteBtn();
    saveCfg();
    hideHint();
  }
  function syncMuteBtn() {
    const b = document.getElementById("lptv-b-mute");
    if (b) {
      b.classList.toggle("muted", !!cfg.muted);
      b.title = cfg.muted ? "取消静音 (M)" : "静音 (M)";
    }
  }

  /* ── 播放控制 ──────────────────────────────────────────────────── */

  function togglePlay() {
    const v = Lptv.video;
    if (!v) return;
    if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    else { v.pause(); Lptv._autoplayPending = false; }
    syncPlayBtn();
  }
  function syncPlayBtn() {
    const b = document.getElementById("lptv-b-play-ico");
    if (b && Lptv.video) b.innerHTML = Lptv.video.paused
      ? '<path d="M8 5l12 7-12 7z"/>'
      : '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  }

  /* ── 数字选台 ──────────────────────────────────────────────────── */

  function handleDigit(d) {
    Lptv.digits += d;
    Lptv.ui.digit.textContent = Lptv.digits;
    Lptv.ui.digit.classList.add("show");
    clearTimeout(Lptv._digitT);
    if (Lptv.digits.length >= 3) commitDigits();
    else Lptv._digitT = setTimeout(commitDigits, 900);
  }
  function commitDigits() {
    const n = parseInt(Lptv.digits, 10);
    Lptv.digits = "";
    Lptv.ui.digit.classList.remove("show");
    if (n >= 1 && n <= Lptv.channels.length) switchChannel(Lptv.channels[n - 1].pid);
    else toast("没有频道 " + n);
  }

  /* ── 面板 / EPG 滑出 ───────────────────────────────────────────── */

  const PANEL_ZONE = 400, PANEL_EDGE = 18;
  const EPG_ZONE = 440, EPG_EDGE = 18;

  function togglePanel() {
    const open = Lptv.ui.panel.classList.toggle("open");
    cancelPanelHide();
    Lptv._panelIn = false;
    if (open) {
      const act = Lptv.ui.panel.querySelector(".lptv-ch.active");
      if (act) act.classList.add("focus");
    }
    return open;
  }
  function hidePanel() {
    cancelPanelHide();
    Lptv._panelIn = false;
    Lptv.ui.panel.classList.remove("open");
  }
  function panelPointer(e) {
    if (Lptv.devHidden) return;
    const x = e.clientX;
    const open = Lptv.ui.panel.classList.contains("open");
    if (open) {
      if (x >= innerWidth - PANEL_ZONE) { Lptv._panelIn = true; cancelPanelHide(); }
      else if (Lptv._panelIn) schedulePanelHide(250);
      return;
    }
    if (x >= innerWidth - PANEL_EDGE) {
      if (Lptv._panelArmed !== false) {
        Lptv._panelArmed = false;
        Lptv._panelIn = true;
        Lptv.ui.panel.classList.add("open");
        markActive();
      }
    } else { Lptv._panelArmed = true; }
  }
  function schedulePanelHide(ms) {
    clearTimeout(Lptv._panelHideT);
    Lptv._panelHideT = setTimeout(() => {
      Lptv._panelIn = false;
      Lptv.ui.panel.classList.remove("open");
    }, ms);
  }
  function cancelPanelHide() { clearTimeout(Lptv._panelHideT); }

  function openEpg() {
    cancelEpgHide();
    Lptv._epgIn = false;
    Lptv.epg._resView = false;
    if (Lptv.epg._day) epgSetDay(0);
    Lptv.ui.epg.classList.add("open");
    epgSync();
    return true;
  }
  function hideEpg() {
    cancelEpgHide();
    Lptv._epgIn = false;
    Lptv.ui.epg.classList.remove("open");
  }
  function toggleEpg() {
    return Lptv.ui.epg.classList.contains("open") ? (hideEpg(), false) : (openEpg(), true);
  }
  function epgPointer(e) {
    if (Lptv.devHidden) return;
    const x = e.clientX;
    const open = Lptv.ui.epg.classList.contains("open");
    if (open) {
      if (x <= EPG_ZONE) { Lptv._epgIn = true; cancelEpgHide(); }
      else if (Lptv._epgIn) scheduleEpgHide(250);
      return;
    }
    if (x <= EPG_EDGE) {
      if (Lptv._epgArmed !== false) {
        Lptv._epgArmed = false;
        Lptv._epgIn = true;
        Lptv.ui.epg.classList.add("open");
        epgSync();
      }
    } else { Lptv._epgArmed = true; }
  }
  function scheduleEpgHide(ms) {
    clearTimeout(Lptv._epgHideT);
    Lptv._epgHideT = setTimeout(() => {
      Lptv._epgIn = false;
      Lptv.ui.epg.classList.remove("open");
    }, ms);
  }
  function cancelEpgHide() { clearTimeout(Lptv._epgHideT); }

  function panelNav(dir) {
    const items = Array.from(Lptv.ui.panel.querySelectorAll(".lptv-ch"));
    if (!items.length) return;
    const cur = Lptv.ui.panel.querySelector(".lptv-ch.focus");
    const idx = cur ? items.indexOf(cur) : -1;
    const next = clamp(idx + dir, 0, items.length - 1);
    items.forEach(it => it.classList.remove("focus"));
    items[next].classList.add("focus");
    items[next].scrollIntoView({ block: "nearest" });
  }
  function panelSelect() {
    const cur = Lptv.ui.panel.querySelector(".lptv-ch.focus");
    if (cur) { switchChannel(cur.dataset.pid); hidePanel(); }
  }

  /* ── EPG ───────────────────────────────────────────────────────── */

  function nowProgOf(pid) {
    const list = (Lptv.epg.cache || {})[pid];
    if (!list || !list.length) return "";
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.s0 <= now && (!p.e0 || now < p.e0)) return p.name || "";
    }
    return "";
  }
  function updateNowProg() {
    const el2 = document.getElementById("lptv-now-prog");
    if (!el2) return;
    el2.textContent = nowProgOf(Lptv.currentPid) || "正在直播";
  }

  function epgDayOffset() { return Lptv.epg._day || 0; }

  async function epgFetch(pid, ymd) {
    if (!/^\d+$/.test(String(pid))) return;
    ymd = ymd || ymdStr(new Date());
    const key = pid + "|" + ymd;
    if ((Lptv.epg.cache || {})[key] || Lptv.epg._fetching === key) return;
    Lptv.epg._fetching = key;
    try {
      const r = await LxApi.fetchEpg(pid, ymd, { signal: AbortSignal.timeout(5000) });
      if (r && r.data) {
        const progs = parseEpg(r.data);
        if (progs.length) epgStore(pid, progs, ymd);
      }
    } catch (e) {
      dbg("epgFetch err: " + e);
    }
    Lptv.epg._fetching = "";
  }

  function epgStore(pid, programs, ymd) {
    try { programs.sort((a, b) => (a.s0 || 0) - (b.s0 || 0)); } catch {}
    for (let k = 0; k < programs.length; k++) {
      if (!programs[k].e0 && programs[k + 1] && programs[k + 1].s0) {
        programs[k].e0 = programs[k + 1].s0;
      }
    }
    ymd = ymd || ymdStr(new Date());
    let key = pid + "|" + ymd;
    if (programs.length && programs[0].s0) {
      const mid = programs[0].s0 + 12 * 3600;
      const dReal = new Date(mid * 1000);
      const realYmd = ymdStr(dReal);
      if (realYmd !== ymd) { ymd = realYmd; key = pid + "|" + ymd; }
    }
    Lptv.epg.cache[key] = programs;
    if (ymd === ymdStr(new Date())) {
      Lptv.epg.cache[pid] = programs;
      Lptv.epg.last = { pid, n: programs.length, t: Date.now() };
      if (Lptv.currentPid === pid) updateNowProg();
    }
    if (Lptv.currentPid === pid && Lptv.epg._day === (Lptv.epg._dayMap || {})[ymd]) epgRender();
  }

  function epgCurList() {
    const key = Lptv.currentPid + "|" + epgYmdOf(epgDayOffset());
    return (Lptv.epg.cache || {})[key];
  }

  function epgRender() {
    const body = document.getElementById("lptv-epg-body");
    if (!body) return;
    epgRenderTabs();
    if (Lptv.epg._resView) { resRender(); return; }
    const pid = Lptv.currentPid;
    const chEl = document.getElementById("lptv-epg-ch");
    if (chEl) chEl.textContent = chNameOf(pid);
    const list = epgCurList();
    if (!list || !list.length) {
      body.innerHTML = '<div class="lptv-epg-empty">节目单加载中…</div>';
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const day = epgDayOffset();
    let hs = -1, html = "";
    list.forEach((p, k) => {
      const live = day === 0 && p.s0 <= now && (!p.e0
        ? (k === list.length - 1) || (list[k + 1] && list[k + 1].s0 > now)
        : now < p.e0);
      const past = day === 0 && p.s0 && !live && p.s0 <= now;
      if (live && hs < 0) hs = k;
      const cls = live ? "live" : (past ? "past" : "future");
      const reservable = !past && p.s0 && p.name;
      const reserved = reservable && resHas(pid, p.s0);
      html += '<div class="lptv-epg-row ' + cls + '" data-pid="' + pid + '" data-s0="' + (p.s0 || 0) + '">' +
        '<span class="lptv-epg-t">' + (p.start || "--") + "-" + (p.end || "--") + '</span>' +
        '<span class="lptv-epg-n">' + (p.name || "") + '</span>' +
        (reservable ? '<span class="lptv-epg-res' + (reserved ? " on" : "") + '" title="' +
          (reserved ? "已预约, 点击取消" : "预约开播提醒") + '">' +
          (reserved ? "已约" : "预约") + '</span>' : "") +
        '</div>';
    });
    body.innerHTML = html;
    if (hs >= 0 && body.children[hs]) {
      setTimeout(() => { try { body.children[hs].scrollIntoView({ block: "center" }); } catch {} }, 30);
    }
  }

  function epgRenderTabs() {
    const tabs = document.getElementById("lptv-epg-tabs");
    if (!tabs) return;
    const res = resLoad();
    const resBadge = res.length ? '<b>' + res.length + '</b>' : "";
    let html = "";
    for (let off = 0; off <= 3; off++) {
      const d = new Date();
      d.setDate(d.getDate() + off);
      const label = off === 0 ? "今天" : off === 1 ? "明天" :
        "周" + ["日","一","二","三","四","五","六"][d.getDay()];
      html += '<span class="lptv-epg-tab' + (epgDayOffset() === off && !Lptv.epg._resView ? " on" : "") + '" data-off="' + off + '">' +
        label + (off > 0 ? "<i>" + (d.getMonth() + 1) + "/" + d.getDate() + "</i>" : "") + '</span>';
    }
    html += '<span class="lptv-epg-tab lptv-epg-tab-res' + (Lptv.epg._resView ? " on" : "") + '" data-off="res">' +
      '预约' + resBadge + '</span>';
    tabs.innerHTML = html;
  }

  function epgSync() {
    if (!Lptv.ui.epg || !Lptv.ui.epg.classList.contains("open")) return;
    const pid = Lptv.currentPid;
    if (!pid) return;
    const ymd = epgYmdOf(epgDayOffset());
    if ((Lptv.epg.cache || {})[pid + "|" + ymd]) { epgRender(); return; }
    epgFetch(pid, ymd);
  }

  function epgSetDay(off) {
    Lptv.epg._day = Math.max(0, Math.min(3, off || 0));
    Lptv.epg._dayMap = Lptv.epg._dayMap || {};
    Lptv.epg._dayMap[epgYmdOf(Lptv.epg._day)] = Lptv.epg._day;
    const dLabel = document.getElementById("lptv-epg-date");
    if (dLabel) {
      const d = new Date();
      d.setDate(d.getDate() + Lptv.epg._day);
      dLabel.textContent = epgDateLabel(d);
    }
    epgRender();
    epgSync();
  }

  /* ── 预约 ──────────────────────────────────────────────────────── */

  function resLoad() {
    try {
      const a = JSON.parse(localStorage.getItem(RES_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch { return []; }
  }
  function resSave(list) {
    try { localStorage.setItem(RES_KEY, JSON.stringify(list)); } catch {}
    pyStatePush({ res: list });
  }
  function resHas(pid, s0) {
    const id = pid + "_" + s0;
    return resLoad().some(r => r.id === id);
  }
  function resToggle(pid, s0, e0, name) {
    const id = pid + "_" + s0;
    const list = resLoad();
    const i = list.findIndex(r => r.id === id);
    const had = i >= 0;
    if (had) list.splice(i, 1);
    else list.push({ id, pid: String(pid), ch: chNameOf(pid), name: name || "", s0, e0: e0 || 0, made: Date.now() });
    resSave(list);
    return !had;
  }

  function resTick() {
    const now = Math.floor(Date.now() / 1000);
    const list = resLoad();
    let changed = false;
    const filtered = list.filter(r => {
      if (r.e0 && r.e0 < now - 15 * 60) { changed = true; return false; }
      if (!r.notified && r.s0 - 60 <= now && now < r.s0 + 5 * 60) {
        r.notified = 1;
        changed = true;
        resNotify(r);
      }
      return true;
    });
    if (changed) {
      resSave(filtered);
      if (Lptv.ui.epg && Lptv.epg._resView) resRender();
      epgRenderTabs();
    }
  }

  function resNotify(r) {
    const t = Lptv.ui.toast;
    if (!t) return;
    t.textContent = "即将开播: " + r.ch + " · " + r.name;
    t.classList.add("show", "_res");
    t._res = r.pid;
    t._resClicked = false;
    clearTimeout(toastTimer);
    clearTimeout(t._resT);
    t._resT = setTimeout(() => { t.classList.remove("show"); t._res = null; }, 12000);
  }

  setInterval(resTick, 20000);
  setTimeout(resTick, 3000);

  function resRender() {
    const body = document.getElementById("lptv-epg-body");
    if (!body) return;
    const chEl = document.getElementById("lptv-epg-ch");
    if (chEl) chEl.textContent = "预约列表";
    const now = Math.floor(Date.now() / 1000);
    const list = resLoad().sort((a, b) => a.s0 - b.s0);
    if (!list.length) {
      body.innerHTML = '<div class="lptv-epg-empty">暂无预约<br><span style="font-size:11px">在节目单中选择节目点"预约"即可</span></div>';
      return;
    }
    let html = "";
    list.forEach(r => {
      const d = new Date(r.s0 * 1000);
      const mm = Math.max(0, Math.round((r.s0 - now) / 60));
      const countdown = mm < 60 ? mm + " 分钟后" : Math.floor(mm / 60) + " 小时 " + (mm % 60) + " 分后";
      html += '<div class="lptv-res-row" data-pid="' + r.pid + '" data-id="' + r.id + '">' +
        '<div class="lptv-res-main">' +
          '<span class="lptv-res-ch">' + r.ch + '</span>' +
          '<span class="lptv-res-name">' + (r.name || "未知节目") + '</span>' +
          '<span class="lptv-res-when">' +
            (d.getMonth() + 1) + "/" + d.getDate() + " " +
            String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") +
            ' <em>' + countdown + '</em></span>' +
        '</div>' +
        '<span class="lptv-res-x" title="取消预约">×</span>' +
        '</div>';
    });
    body.innerHTML = html;
  }

  /* ── 黑帧看门狗 ─────────────────────────────────────────────────── */

  const wcanvas = document.createElement("canvas");
  wcanvas.width = 48;
  wcanvas.height = 27;
  const wctx = wcanvas.getContext("2d");

  setInterval(() => {
    const v = Lptv.video;
    if (!v || v.paused || v.readyState < 2 || !v.videoWidth) return;
    try {
      wctx.drawImage(v, 0, 0, 48, 27);
      const d = wctx.getImageData(0, 0, 48, 27).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i+1] + d[i+2];
      const avg = sum / ((d.length / 4) * 3);
      if (avg < 12) {
        Lptv.darkCount++;
        if (Lptv.darkCount >= 3) recoverBlack();
      } else { Lptv.darkCount = 0; }
    } catch {}
  }, 4000);

  function recoverBlack() {
    Lptv.darkCount = 0;
    toast("检测到黑帧，已自动恢复");
    if (Lptv.video && Lptv.playUrl) {
      try { Lptv.video.src = Lptv.playUrl; Lptv.video.load(); } catch(e) {}
    }
  }

  /* ── 录制 ──────────────────────────────────────────────────────── */

  const Rec = {
    on: false, rid: 0, mr: null, ac: null, srcNode: null,
    canvas: null, cctx: null, stream: null, chunks: [],
    t0: 0, timer: null, bytes: 0, frames: 0,
    video: null, vw: 0, vh: 0,
  };

  function recSupported() {
    return !!(window.MediaRecorder && document.createElement("canvas").captureStream);
  }

  function recTick() {
    const el2 = document.getElementById("lptv-rec-time");
    if (!el2) return;
    const s = Math.floor((Date.now() - Rec.t0) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    el2.textContent = "REC " + mm + ":" + ss + " · " + (Rec.bytes / 1048576).toFixed(1) + "MB";
  }

  function recSetUI(on) {
    const btn = document.getElementById("lptv-b-rec");
    const badge = document.getElementById("lptv-rec-badge");
    if (btn) {
      btn.classList.toggle("rec-on", on);
      btn.title = on ? "停止录制 (R)" : "录制节目 (R)";
    }
    if (badge) badge.classList.toggle("show", on);
    if (on) {
      Rec.t0 = Date.now(); Rec.bytes = 0;
      recTick();
      Rec.timer = setInterval(recTick, 1000);
    } else {
      clearInterval(Rec.timer);
    }
  }

  function recDestroyGraph() {
    try { if (Rec.mr && Rec.mr.state !== "inactive") Rec.mr.stop(); } catch {}
    Rec.mr = null;
    try { if (Rec.stream) Rec.stream.getTracks().forEach(t => t.stop()); } catch {}
    Rec.stream = null;
  }

  function recEnsureAudio(v) {
    if (Rec.srcNode && Rec.video === v) return Rec.srcNode;
    try {
      if (!Rec.ac) Rec.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (Rec.ac.state === "suspended") Rec.ac.resume();
      if (Rec.srcNode) { try { Rec.srcNode.disconnect(); } catch {} Rec.srcNode = null; }
      Rec.srcNode = Rec.ac.createMediaElementSource(v);
      Rec.srcNode.connect(Rec.ac.destination);
      Rec.video = v;
    } catch { Rec.srcNode = null; }
    return Rec.srcNode;
  }

  async function recStart() {
    const v = Lptv.video;
    if (!v || !v.videoWidth) { toast("画面尚未就绪，稍后再录"); return; }
    if (!recSupported()) { toast("当前环境不支持录制"); return; }
    if (!document.hasFocus()) { toast("仅前台可录制 · 请先点击本页面"); return; }
    if (Rec.on) return;
    const api = LxApi;

    let mime = "";
    const cands = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const c of cands) {
      try { if (MediaRecorder.isTypeSupported(c)) { mime = c; break; } } catch {}
    }
    if (!mime) { toast("不支持 webm 编码"); return; }

    Rec.canvas = document.createElement("canvas");
    Rec.canvas.width = v.videoWidth;
    Rec.canvas.height = v.videoHeight;
    Rec.cctx = Rec.canvas.getContext("2d");
    Rec.vw = v.videoWidth;
    Rec.vh = v.videoHeight;

    const cs = Rec.canvas.captureStream(0);
    let hasAudio = false;
    const aSrc = recEnsureAudio(v);
    if (aSrc) {
      try {
        const dest = Rec.ac.createMediaStreamDestination();
        aSrc.connect(dest);
        const merged = new MediaStream(cs.getVideoTracks().concat(dest.stream.getAudioTracks()));
        if (merged.getAudioTracks().length) hasAudio = true;
      } catch {}
    }

    let mr;
    try { mr = new MediaRecorder(cs, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); }
    catch { try { mr = new MediaRecorder(cs, { mimeType: mime }); } catch { toast("录制器创建失败"); return; } }

    Rec.mr = mr;
    Rec.chunks = [];
    mr.ondataavailable = (ev) => {
      if (!ev.data || !ev.data.size) return;
      Rec.bytes += ev.data.size;
      if (ev.data.size <= 72000) Rec.chunks.push(ev.data);
      else {
        let off = 0;
        while (off < ev.data.size) { Rec.chunks.push(ev.data.slice(off, off + 72000)); off += 72000; }
      }
      recFlush();
    };
    mr.onerror = () => recStop(true);

    Rec.stream = cs;
    Rec._raf = recFrame;

    const openR = await api.recOpen(chNameOf(Lptv.currentPid) || "直播");
    if (!openR || !openR.ok) { toast("无法创建录制文件: " + (openR && openR.error)); recStop(true); return; }
    Rec.rid = openR.id;
    Rec.on = true;
    recSetUI(true);
    toast("开始录制 · 切至后台自动停止" + (hasAudio ? "" : " (无声)"));
    recFrame();
  }

  function recFrame() {
    if (!Rec.on) return;
    const v = Lptv.video;
    if (!v || !v.videoWidth) { requestAnimationFrame(Rec._raf); return; }
    if (v !== Rec.video || v.videoWidth !== Rec.vw || v.videoHeight !== Rec.vh) {
      toast("画面源已变化，录制已停止");
      recStop();
      return;
    }
    try { Rec.cctx.drawImage(v, 0, 0, Rec.vw, Rec.vh); } catch {}
    const track = Rec.stream && Rec.stream.getVideoTracks()[0];
    if (track && track.requestFrame) track.requestFrame();
    Rec.frames++;
    requestAnimationFrame(Rec._raf);
  }

  function recFlush() {
    if (Rec._flushing || !Rec.chunks.length || !Rec.rid) return;
    const api = LxApi;
    if (!api) return;
    const blob = Rec.chunks.shift();
    Rec._flushing = true;
    const fr = new FileReader();
    fr.onload = () => {
      const b64 = String(fr.result).split(",")[1] || "";
      api.recAppend(Rec.rid, b64).then((r) => {
        Rec._appends = (Rec._appends || 0) + 1;
        Rec._written = (r && r.size) || 0;
        Rec._flushing = false;
        recFlush();
      }, () => { Rec._flushing = false; });
    };
    fr.onerror = () => { Rec._flushing = false; };
    fr.readAsDataURL(blob);
  }

  function recStop(silent) {
    if (!Rec.on && !Rec.mr) return;
    const rid = Rec.rid;
    const bytes = Rec.bytes, frames = Rec.frames;
    Rec.on = false;
    try { if (Rec.mr && Rec.mr.state === "recording") Rec.mr.requestData(); } catch {}
    recDestroyGraph();
    clearInterval(Rec.timer);
    recSetUI(false);
    Rec.frames = 0;
    const api = LxApi;

    function drain(i) {
      if (i > 60) return done();
      if (Rec.chunks.length || Rec._flushing) {
        recFlush();
        setTimeout(() => drain(i + 1), 50);
      } else if (i < 6) {
        setTimeout(() => drain(i + 1), 50);
      } else { done(); }
    }
    function done() {
      Rec.chunks = [];
      Rec.rid = 0;
      if (api && rid) api.recClose(rid).catch(() => {});
      if (!silent) toast("录制已保存 · " + (bytes / 1048576).toFixed(1) + "MB / " + frames + " 帧");
    }
    drain(0);
  }

  function recToggle() { Rec.on ? recStop() : recStart(); }

  window.addEventListener("blur", () => {
    if (Rec.on) { toast("窗口已切至后台，录制自动停止"); recStop(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (Rec.on && document.visibilityState === "hidden") {
      toast("页面已隐藏，录制自动停止");
      recStop();
    }
  });

  /* ── 截图 ──────────────────────────────────────────────────────── */

  async function shotTake() {
    const v = Lptv.video;
    if (!v || !v.videoWidth) { toast("画面尚未就绪"); return; }
    try {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const x = c.getContext("2d");
      x.drawImage(v, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/png");
      const api = LxApi;
      const r = await api.shotSave(chNameOf(Lptv.currentPid) || "直播", String(data).split(",")[1] || "");
      if (r && r.ok) toast("已截图 · " + r.name);
      else toast("截图失败: " + (r && r.error || ""));
      const fl = document.getElementById("lptv-shot-flash");
      if (fl) { fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go"); }
    } catch (e) { toast("截图失败: " + e); }
  }

  /* ── 空闲检测 ──────────────────────────────────────────────────── */

  let idleTimer = null;
  const CTRL_ZONE = 170;
  let ctrlTimer = null;

  function wake() {
    if (Lptv.devHidden) return;
    Lptv.ui.root.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => Lptv.ui.root.classList.add("idle"), cfg.autoHide);
  }

  function showControls() {
    clearTimeout(ctrlTimer);
    Lptv.ui.controls.classList.add("show");
    Lptv.ui.root.classList.add("ctrl-on");
  }
  function scheduleHideControls() {
    clearTimeout(ctrlTimer);
    ctrlTimer = setTimeout(() => {
      Lptv.ui.controls.classList.remove("show");
      Lptv.ui.root.classList.remove("ctrl-on");
      Lptv.ui.settings.classList.remove("open");
    }, 900);
  }
  function cancelHideControls() { clearTimeout(ctrlTimer); }

  /* ── 事件绑定 ──────────────────────────────────────────────────── */

  function bindEvents() {
    if (window.__LptvIframe) return; // iframe mode: parent handles events
    const root = Lptv.ui.root;

    document.addEventListener("mousemove", (e) => {
      wake();
      panelPointer(e);
      epgPointer(e);
      if (e.clientY >= innerHeight - CTRL_ZONE) showControls();
      else scheduleHideControls();
    });
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget && !e.toElement) {
        if (Lptv._panelIn) schedulePanelHide(0);
        if (Lptv._epgIn) scheduleEpgHide(0);
        scheduleHideControls();
      }
    });
    document.addEventListener("mousedown", wake, true);

    // 长名称气泡
    const NAME_POP_SEL = ".lptv-epg-n,.lptv-res-name";
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest && e.target.closest(NAME_POP_SEL);
      const pop = document.getElementById("lptv-name-pop");
      if (!pop) return;
      if (t && t.scrollWidth > t.clientWidth + 1) {
        pop.textContent = t.textContent;
        pop.classList.add("show");
        const r = t.getBoundingClientRect();
        pop.style.left = Math.max(4, Math.min(r.left, innerWidth - 440)) + "px";
        let top = r.bottom + 6;
        const ph = pop.offsetHeight || 40;
        if (top + ph > innerHeight) top = r.top - ph - 6;
        pop.style.top = Math.max(4, top) + "px";
      } else { pop.classList.remove("show"); }
    });
    document.addEventListener("mouseout", (e) => {
      const t = e.target.closest && e.target.closest(NAME_POP_SEL);
      if (t) {
        const pop = document.getElementById("lptv-name-pop");
        if (pop) pop.classList.remove("show");
      }
    });

    document.addEventListener("wheel", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("#lptv-panel,#lptv-settings,#lptv-epg")) {
        document.getElementById("lptv-name-pop")?.classList.remove("show");
        return;
      }
      e.preventDefault();
      setVolume((Lptv.video ? Lptv.video.volume : cfg.volume) + (e.deltaY < 0 ? 0.05 : -0.05));
    }, { passive: false });

    Lptv.ui.controls.addEventListener("mouseenter", cancelHideControls);
    Lptv.ui.controls.addEventListener("mouseleave", scheduleHideControls);
    Lptv.ui.settings.addEventListener("mouseenter", cancelHideControls);
    Lptv.ui.settings.addEventListener("mouseleave", scheduleHideControls);

    // 频道面板事件
    document.getElementById("lptv-panel-body")?.addEventListener("click", (e) => {
      const fav = e.target.closest(".lptv-ch-fav");
      if (fav) {
        e.stopPropagation();
        const on = favToggle(fav.dataset.pid);
        toast(on ? "已收藏: " + chNameOf(fav.dataset.pid) : "已取消收藏");
        renderPanel();
        return;
      }
      const item = e.target.closest(".lptv-ch");
      if (!item) return;
      switchChannel(item.dataset.pid);
      hidePanel();
    });
    document.getElementById("lptv-panel-tabs")?.addEventListener("click", (e) => {
      const t = e.target.closest(".lptv-ptab");
      if (!t) return;
      Lptv._panelFilter = t.dataset.f;
      renderPanel();
    });

    // EPG 事件
    document.getElementById("lptv-epg-tabs")?.addEventListener("click", (e) => {
      const t = e.target.closest(".lptv-epg-tab");
      if (!t) return;
      if (t.dataset.off === "res") {
        Lptv.epg._resView = !Lptv.epg._resView;
        epgRender();
        return;
      }
      Lptv.epg._resView = false;
      epgSetDay(parseInt(t.dataset.off, 10) || 0);
    });
    document.getElementById("lptv-epg-body")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("lptv-res-x")) {
        const row = e.target.closest(".lptv-res-row");
        if (!row) return;
        const list = resLoad().filter(r => r.id !== row.dataset.id);
        resSave(list);
        toast("已取消预约");
        resRender();
        epgRenderTabs();
        return;
      }
      const res = e.target.closest(".lptv-epg-res");
      if (res) {
        const row2 = res.closest(".lptv-epg-row");
        if (!row2) return;
        const pid = row2.dataset.pid, s0 = parseInt(row2.dataset.s0, 10) || 0;
        if (!pid || !s0) return;
        const key = pid + "|" + epgYmdOf(epgDayOffset());
        const p = ((Lptv.epg.cache || {})[key] || []).find(x => x.s0 === s0);
        const on = resToggle(pid, s0, p && p.e0, p && p.name);
        toast(on ? "已预约开播提醒: " + (p ? p.name : "") : "已取消预约");
        res.classList.toggle("on", on);
        res.textContent = on ? "已约" : "预约";
        res.title = on ? "已预约, 点击取消" : "预约开播提醒";
        epgRenderTabs();
        return;
      }
      const rr = e.target.closest(".lptv-res-row");
      if (rr && rr.dataset.pid) { switchChannel(rr.dataset.pid); hideEpg(); }
    });
    Lptv.ui.toast?.addEventListener("click", () => {
      const pid = Lptv.ui.toast._res;
      if (pid) {
        Lptv.ui.toast._resClicked = true;
        switchChannel(pid);
        Lptv.ui.toast.classList.remove("show");
        Lptv.ui.toast._res = null;
        clearTimeout(Lptv.ui.toast._resJump);
      }
    });

    // 全屏
    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest("#lptv-controls,#lptv-nextch,#lptv-panel,#lptv-epg,#lptv-settings,#lptv-toast,#lptv-hint,#lptv-osd,#lptv-vol,#lptv-digit,#lptv-topbar,#lptv-rec-badge")) return;
      const now = Date.now();
      if (now - (Lptv._lastTap || 0) < 350) {
        Lptv._lastTap = 0;
        if (document.documentElement.requestFullscreen) {
          const df = document.documentElement.requestFullscreen();
          if (df && df.catch) df.catch(() => {});
        }
      } else { Lptv._lastTap = now; }
    });

    Lptv.ui.volRange?.addEventListener("input", () => { setVolume(this.value / 100); });
    Lptv.ui.volRange2?.addEventListener("input", () => { setVolume(this.value / 100); });

    Lptv.ui.controls?.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      switch (t.id) {
        case "lptv-b-prev": stepChannel(-1); break;
        case "lptv-b-next": stepChannel(1); break;
        case "lptv-b-play": togglePlay(); break;
        case "lptv-b-mute": toggleMute(); break;
        case "lptv-b-rec": recToggle(); break;
        case "lptv-b-shot": shotTake(); break;
        case "lptv-b-epg": toggleEpg(); break;
        case "lptv-b-panel": togglePanel(); break;
        case "lptv-b-set": Lptv.ui.settings.classList.toggle("open"); break;
      }
    });

    Lptv.ui.settings?.addEventListener("change", (e) => {
      const t = e.target;
      if (t.id === "lptv-s-resume") { cfg.resumeLast = t.checked; pyStatePush({ resumeLast: t.checked }); }
      if (t.id === "lptv-s-fit") { cfg.fit = t.value; saveCfg(); }
      saveCfg();
    });

    Lptv.ui.settings?.addEventListener("click", (e) => {
      if (e.target.closest("#lptv-s-about")) {
        Lptv.ui.settings.classList.remove("open");
        Lptv.ui.about.classList.add("open");
        return;
      }
    });

    Lptv.ui.about?.addEventListener("click", (e) => {
      if (e.target.id === "lptv-about" || e.target.id === "lptv-about-x") Lptv.ui.about.classList.remove("open");
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && (e.key === "d" || e.key === "D")) { e.preventDefault(); Lptv.devHidden = !Lptv.devHidden; Lptv.ui.root.classList.toggle("dev-hidden", Lptv.devHidden); return; }
      if (Lptv.devHidden) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) { e.preventDefault(); e.stopPropagation(); handleDigit(k); }
      else if (k === "ArrowUp") { e.preventDefault(); e.stopPropagation(); Lptv.ui.panel.classList.contains("open") ? panelNav(-1) : stepChannel(-1); }
      else if (k === "ArrowDown") { e.preventDefault(); e.stopPropagation(); Lptv.ui.panel.classList.contains("open") ? panelNav(1) : stepChannel(1); }
      else if (k === "PageUp") { e.preventDefault(); e.stopPropagation(); stepChannel(-1); }
      else if (k === "PageDown") { e.preventDefault(); e.stopPropagation(); stepChannel(1); }
      else if (k === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); setVolume((Lptv.video ? Lptv.video.volume : cfg.volume) - 0.05); }
      else if (k === "ArrowRight") { e.preventDefault(); e.stopPropagation(); setVolume((Lptv.video ? Lptv.video.volume : cfg.volume) + 0.05); }
      else if (k === "Enter") { if (Lptv.ui.panel.classList.contains("open")) { e.preventDefault(); e.stopPropagation(); panelSelect(); } }
      else if (k === " ") { e.preventDefault(); e.stopPropagation(); togglePlay(); }
      else if (k === "m" || k === "M") { if (!e.ctrlKey && !e.altKey) { e.stopPropagation(); toggleMute(); } }
      else if (k === "s" || k === "S") { if (!e.ctrlKey && !e.altKey) { e.stopPropagation(); togglePanel(); } }
      else if (k === "e" || k === "E") { if (!e.ctrlKey && !e.altKey) { e.stopPropagation(); toggleEpg(); } }
      else if (k === "r" || k === "R") { if (!e.ctrlKey && !e.altKey) { e.stopPropagation(); recToggle(); } }
      else if (k === "x" || k === "X") { if (!e.ctrlKey && !e.altKey) { e.stopPropagation(); shotTake(); } }
      else if (k === "F11") {
        e.preventDefault();
        if (document.documentElement.requestFullscreen) {
          const df = document.documentElement.requestFullscreen();
          if (df && df.catch) df.catch(() => {});
        }
      }
      else if (k === "Escape") { hidePanel(); hideEpg(); Lptv.ui.settings.classList.remove("open"); Lptv.ui.about.classList.remove("open"); }
      wake();
    }, true);

    setInterval(() => updateNowProg(), 30000);
    setInterval(() => syncPlayBtn(), 2000);
  }

  /* ── 频道数据 ──────────────────────────────────────────────────── */

  Lptv.setChannels = function (channels) {
    Lptv.channels = channels.map(c => {
      const official = c.official || c.name.split(" ")[0].replace("CCTV-", "CCTV");
      return Object.assign({}, c, { official });
    }).filter(c => c.category !== "付费" && !isPayChannel(c.official || "") && !isPayChannel(c.name || ""));
    renderPanel();
    setChLabel();
  };

  Lptv.switchChannel = function (pid) { switchChannel(pid); };
  Lptv.getPlayUrl = function () {
    if (Lptv.playUrl) return Lptv.playUrl;
    const src = Lptv.video && Lptv.video.currentSrc;
    return src && src.indexOf("http") === 0 ? src : "";
  };
  Lptv.toast = toast;
  Lptv.recToggle = recToggle;
  Lptv.resTick = resTick;
  Lptv.recState = function () {
    return { on: Rec.on, rid: Rec.rid, bytes: Rec.bytes, frames: Rec.frames,
             ac: !!Rec.ac, src: !!Rec.srcNode, mime: (Rec.mr && Rec.mr.mimeType) || "" };
  };

  /* ── 启动 ──────────────────────────────────────────────────────── */

  async function initChannels() {
    // 先从代理获取频道列表
    try {
      const r = await LxApi.getChannels({ signal: AbortSignal.timeout(5000) });
      if (r && r.data && Array.isArray(r.data.channelList)) {
        const chs = r.data.channelList.map(c => ({
          pid: String(c.channelId || c.pid || c.id),
          name: c.name || c.channelName || "未知",
          official: c.name || c.channelName || "",
          category: inferCategory(c.name || ""),
        })).filter(c => !isPayChannel(c.name));
        Lptv.setChannels(chs);
      }
    } catch (e) {
      dbg("getChannels failed: " + e);
    }

    // 从 URL 读取 pid
    const m = location.href.match(/[?&]pid=(\d+)/);
    const urlPid = m ? m[1] : "";
    Lptv.currentPid = urlPid || (Lptv.channels[0] && Lptv.channels[0].pid || "");

    // 恢复状态
    try {
      const st = await LxApi.getState({ signal: AbortSignal.timeout(5000) });
      if (st && st.ok) {
        if (Array.isArray(st.favs) && st.favs.length) {
          cfg.favs = st.favs.filter(pid => Lptv.channels.some(c => c.pid === pid));
          saveCfg();
        }
        if (typeof st.resumeLast === "boolean") cfg.resumeLast = st.resumeLast;
        if (st.lastPid) cfg.lastPid = st.lastPid;
        if (Array.isArray(st.res) && st.res.length) {
          try { localStorage.setItem(RES_KEY, JSON.stringify(st.res)); } catch {}
          epgRenderTabs();
        }
        const rs = document.getElementById("lptv-s-resume");
        if (rs) rs.checked = cfg.resumeLast !== false;
      }
    } catch {}

    // 恢复上次频道
    if (cfg.resumeLast !== false && cfg.lastPid && cfg.lastPid !== urlPid &&
        Lptv.channels.some(c => c.pid === cfg.lastPid)) {
      dbg("resume last: " + cfg.lastPid);
      setTimeout(() => switchChannel(cfg.lastPid), 800);
    }

    markActive();
    dbg("channels=" + Lptv.channels.length + " cur=" + Lptv.currentPid);
  }

   function boot() {
     buildUI();
     bindEvents();
     initChannels();
   }

   // 允许外部补丁 (patch.js) 增强 boot
   window.__lptvBoot = boot;
   window.boot = boot;

   // iframe mode: listen for commands from parent, send OSD/toast back
   if (window.__LptvIframe) {
     window.addEventListener("message", function(e) {
       var d = e.data;
       if (!d || d.type !== "lptv-cmd") return;
       if (d.cmd === "switch") switchChannel(d.pid);
       else if (d.cmd === "vol") setVolume(d.val);
       else if (d.cmd === "mute") toggleMute();
       else if (d.cmd === "play") togglePlay();
       else if (d.cmd === "prev") stepChannel(-1);
       else if (d.cmd === "next") stepChannel(1);
       else if (d.cmd === "rec") recToggle();
       else if (d.cmd === "shot") shotTake();
     });
   }

   if (document.readyState === "complete" || document.readyState === "interactive") {
     setTimeout(function () { (window.boot || boot)(); }, 100);
   } else {
     document.addEventListener("DOMContentLoaded", () => setTimeout(function () { (window.boot || boot)(); }, 100));
   }
})();
