/* LPTV Web — 核心功能补充补丁 (从 inject.js 移植)
 *
 * 补充内容:
 *   1. get_live_info XHR/fetch hook → onPlayUrl()
 *   2. acquireOfficial() + styleOfficial() + bindVideoEvents()
 *   3. installHlsHooks() + applyMaxQuality() + setQuality()
 *   4. harvestOfficial() + findOfficialButton()
 *   5. 更新 switchChannel() 支持 DOM 交互
 *   6. 更新 boot() 调用新函数
 */

(function () {
  if (!window.__lptvCctvWeb) return;

  /* ── Hook: 拦截 get_live_info → playUrl ─────────────────────────── */

  const OrigOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const u = String(url || "");
    if (u.indexOf("get_live_info") >= 0) {
      this.addEventListener("load", function () {
        try {
          const d = JSON.parse(this.responseText).data;
          if (d && d.iretcode === 0 && d.playurl) onPlayUrl(d.playurl);
        } catch (e) {}
      });
    }
    // EPG: 官方切台时抓 protobuf 节目数据
    if (u.indexOf("/api/yspepg/program/") >= 0) {
      this.addEventListener("load", function () {
        try {
          if (this.responseType !== "arraybuffer") return;
          const m2 = String(this.responseURL || url).match(/program\/(\d+)\/(\d{8})/);
          if (m2) {
            const progs = parseEpg(this.response);
            if (progs.length) epgStore(m2[1], progs, m2[2]);
          }
        } catch (e) {}
      });
    }
    return OrigOpen.apply(this, arguments);
  };

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      const url = arguments[0] && String(arguments[0]);
      const p = origFetch.apply(this, arguments);
      if (url && url.indexOf("get_live_info") >= 0) {
        p.then(function (r) {
          return r.clone().json().then(function (d) {
            const dd = d && d.data;
            if (dd && dd.iretcode === 0 && dd.playurl) onPlayUrl(dd.playurl);
          }).catch(function () {});
        });
      }
      return p;
    };
  }

  /* ── onPlayUrl ─────────────────────────────────────────────────── */

  function pidFromUrl(u) {
    const m = String(u).match(/[?&]pid=(\d+)/);
    return m ? m[1] : "";
  }

  function onPlayUrl(url) {
    const pid = pidFromUrl(url);
    if (pid) {
      // 防过期响应: 切台后6s内旧响应不得回写
      if (window.__lptvCctvWeb._pidBefore && pid === window.__lptvCctvWeb._pidBefore &&
          Date.now() - (window.__lptvCctvWeb._switchAt || 0) < 6000) {
        dbg("stale pu ignored: " + pid);
        return;
      }
      // 合成 pid(x...) 替换为真实 pid
      if (window.__lptvCctvWeb.currentPid && String(window.__lptvCctvWeb.currentPid).charAt(0) === "x") {
        const ch = window.__lptvCctvWeb.channels.find(function (c) { return c.pid === window.__lptvCctvWeb.currentPid; });
        if (ch) ch.pid = pid;
      }
      window.__lptvCctvWeb.currentPid = pid;
    }
    if (pid && /^\d+$/.test(String(pid))) {
      cfg.lastPid = pid;
      saveCfg();
      pyStatePush({ lastPid: pid });
    }
    markActive();
    epgSync();
    if (url === window.__lptvCctvWeb.playUrl) return;
    window.__lptvCctvWeb.playUrl = url;
    window.__lptvCctvWeb._loadedPid = pid || window.__lptvCctvWeb._loadedPid;
    dbg("pu:" + url.slice(0, 30));
    showOSD(chNumLabel(), "正在直播 · " + chNameOf(window.__lptvCctvWeb.currentPid));
  }

  /* ── 官方视频元素获取 ───────────────────────────────────────────── */

  function acquireOfficial() {
    const list = document.querySelectorAll("video");
    let cand = null;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!cand) cand = v;
      if (v.videoWidth && (!cand.videoWidth || v.videoWidth > cand.videoWidth)) cand = v;
    }
    if (!cand) return;
    if (cand !== window.__lptvCctvWeb.video) {
      dbg("ov=" + (cand === window.__lptvCctvWeb.video ? "same" : "acquire"));
      window.__lptvCctvWeb.video = cand;
      if (!window.__lptvCctvWeb._ovBound) { bindVideoEvents(); window.__lptvCctvWeb._ovBound = true; }
      styleOfficial();
    }
  }

  function styleOfficial() {
    const v = window.__lptvCctvWeb.video;
    if (!v) return;
    v.style.setProperty("position", "fixed", "important");
    v.style.setProperty("left", "0px", "important");
    v.style.setProperty("top", "0px", "important");
    v.style.setProperty("width", "100vw", "important");
    v.style.setProperty("height", "100vh", "important");
    v.style.setProperty("z-index", "2147483001", "important");
    v.style.setProperty("object-fit", cfg.fit === "cover" ? "cover" : "contain", "important");
    v.style.setProperty("background", "#000", "important");
    v.style.setProperty("max-width", "none", "important");
    v.style.setProperty("max-height", "none", "important");
    v.style.setProperty("margin", "0", "important");
  }

  function bindVideoEvents() {
    const v = window.__lptvCctvWeb.video;
    v.addEventListener("loadeddata", function () { showSpin(false); });
    v.addEventListener("waiting", function () { showSpin(true); dbg("vwaiting t=" + Math.floor(v.currentTime)); });
    v.addEventListener("stalled", function () { showSpin(true); dbg("vstalled"); });
    v.addEventListener("volumechange", function () {
      if (window.__lptvCctvWeb._volLock || !cfg || cfg.muted) return;
      const want = cfg.volume != null ? cfg.volume : 1;
      if (Math.abs(v.volume - want) > 0.02) {
        window.__lptvCctvWeb._volLock = true;
        v.volume = want;
        setTimeout(function () { window.__lptvCctvWeb._volLock = false; }, 50);
        dbg("volock " + Math.round(v.volume * 100) + "->" + Math.round(want * 100));
      }
    });
    v.addEventListener("playing", function () {
      window.__lptvCctvWeb._resumes = 0;
      showSpin(false);
      dbg("vplaying t=" + Math.floor(v.currentTime));
      if (!cfg.muted && v.volume !== (cfg.volume != null ? cfg.volume : 1)) {
        v.volume = cfg.volume != null ? cfg.volume : 1;
      }
      showOSD(chNumLabel(), "正在直播 · " + chNameOf(window.__lptvCctvWeb.currentPid));
      hideHint();
    });
    v.addEventListener("pause", function () { dbg("vpause t=" + Math.floor(v.currentTime)); handleExternalPause(); });
    v.addEventListener("error", function () { dbg("verror " + (v.error && v.error.code)); });
  }

  let _resumeT = null;
  function handleExternalPause() {
    const v = window.__lptvCctvWeb.video;
    if (!window.__lptvCctvWeb._autoplayPending || !v) return;
    if (!(v.readyState >= 2 && v.videoWidth)) return;
    if (window.__lptvCctvWeb._resumes > 12) return;
    clearTimeout(_resumeT);
    _resumeT = setTimeout(function () {
      if (window.__lptvCctvWeb._autoplayPending && v.paused && v.readyState >= 2 && v.videoWidth) {
        window.__lptvCctvWeb._resumes = (window.__lptvCctvWeb._resumes || 0) + 1;
        dbg("vresume #" + window.__lptvCctvWeb._resumes);
        tryPlay();
      }
    }, 400);
  }

  function tryPlay() {
    const v = window.__lptvCctvWeb.video;
    if (!v) return;
    v.volume = cfg.volume;
    v.muted = cfg.muted;
    const p = v.play();
    if (p && p.catch) {
      p.catch(function () {
        dbg("tryPlay reject (policy)");
        v.muted = true;
        cfg.muted = true; saveCfg(); syncMuteBtn();
        const p2 = v.play();
        if (p2 && p2.catch) p2.catch(function () { dbg("tryPlay2 reject"); });
        showHint("受自动播放策略影响已静音播放，按 M 键开启声音");
      });
    } else {
      dbg("tryPlay ok");
    }
  }

  /* ── 画质控制 ──────────────────────────────────────────────────── */

  function installHlsHooks() {
    if (!window.Hls || window.Hls.__lptvBoosted) return;
    window.Hls.__lptvBoosted = true;
    const origLoad = window.Hls.prototype.loadSource;
    window.Hls.prototype.loadSource = function (url) {
      window.__lptvCctvWeb.currentHls = this;
      dbg("hls: source " + String(url).slice(0, 26));
      if (cfg.maxQuality) applyMaxQuality(this);
      return origLoad.apply(this, arguments);
    };
  }

  function applyMaxQuality(inst) {
    if (!inst || !cfg.maxQuality) return;
    let tries = 0;
    const timer = setInterval(function () {
      tries++;
      let done = false;
      try {
        const lv = inst.levels;
        if (lv && lv.length) {
          let mx = 0;
          for (let i = 1; i < lv.length; i++) {
            if (lv[i].bitrate > lv[mx].bitrate) mx = i;
          }
          try { if (inst.currentLevel !== mx) inst.currentLevel = mx; } catch (e) {}
          done = tries >= 4;
        } else if (tries >= 15) {
          done = true;
        }
      } catch (e) { done = tries >= 15; }
      if (done) clearInterval(timer);
    }, 500);
  }

  function setQuality() {
    const inst = window.__lptvCctvWeb.currentHls;
    if (!inst) return;
    if (cfg.maxQuality) applyMaxQuality(inst);
    else {
      try {
        if (inst.currentLevel > -1) inst.currentLevel = -1;
        inst.autoLevelEnabled = true;
        inst.loadLevel = -1;
      } catch (e) {}
    }
  }

  /* ── 保活定时器 ────────────────────────────────────────────────── */

  setInterval(function () {
    acquireOfficial();
    styleOfficial();
    const v = window.__lptvCctvWeb.video;
    if (!v) return;
    if (v.paused && window.__lptvCctvWeb._autoplayPending && v.readyState >= 2 && v.videoWidth &&
        (window.__lptvCctvWeb._resumes || 0) < 12) {
      dbg("wkr " + Math.floor(v.currentTime));
      tryPlay();
    }
  }, 3000);

  /* ── 频道按钮查找 ──────────────────────────────────────────────── */

  function findOfficialButton(official) {
    const want = String(official || "").replace(/\s+/g, "");
    if (!want) return null;
    const items = document.querySelectorAll(".tv-main-con-r-list-left > div");
    for (let i = 0; i < items.length; i++) {
      const txt = (items[i].textContent || "").trim().replace(/\s+/g, "");
      if (txt === want || txt.indexOf(want) >= 0) return items[i];
    }
    return null;
  }

  /* ── 侧栏频道收割 ──────────────────────────────────────────────── */

  function harvestOfficial() {
    const cont = document.querySelector(".tv-main-con-r-list-left");
    if (!cont) return 0;
    const els = Array.prototype.slice.call(cont.children).filter(function (e) { return e.tagName === "DIV"; });
    if (els.length < 30) return 0;
    const sb = els.map(function (e) { return (e.textContent || "").trim().replace(/\s+/g, " "); })
      .filter(function (t) { return !isPayChannel(t); });
    // 校正已知频道 official 为官网按钮文字
    window.__lptvCctvWeb.channels.forEach(function (c) {
      let hit = null;
      sb.forEach(function (t) {
        if (t.indexOf(c.official) > -1 && (!hit || Math.abs(t.length - c.official.length) < Math.abs(hit.length - c.official.length))) hit = t;
      });
      if (hit) c.official = hit;
    });
    // 追加官网有、我们缺的频道
    const seen = {};
    window.__lptvCctvWeb.channels.forEach(function (c) { seen[c.official] = true; });
    let added = 0;
    sb.forEach(function (t) {
      if (seen[t]) return;
      seen[t] = true;
      window.__lptvCctvWeb.channels.push({
        name: t, pid: "x" + (10000 + added), cnlid: "", official: t, category: inferCategory(t)
      });
      added++;
    });
    return added;
  }

  /* ── 更新 switchChannel ────────────────────────────────────────── */

  // _origSwitchChannel removed: not used

  function switchChannelDom(pid) {
    if (!pid) return;
    if (pid !== window.__lptvCctvWeb.currentPid) {
      window.__lptvCctvWeb._pidBefore = window.__lptvCctvWeb.currentPid;
      window.__lptvCctvWeb._switchAt = Date.now();
    }
    window.__lptvCctvWeb.currentPid = pid;
    if (/^\d+$/.test(String(pid))) {
      cfg.lastPid = pid;
      saveCfg();
      pyStatePush({ lastPid: pid });
    }
    markActive();
    epgSync();
    showOSD(chNumLabel(), chNameOf(pid) + " · 正在切换…", true);
    showSpin(true);

    // 方法1: 点击官方侧栏按钮
    const btn = findOfficialButton(officialNameOf(pid));
    if (btn) {
      dbg("click btn: " + officialNameOf(pid));
      btn.click();
    } else if (officialNameOf(pid) !== "") {
      // 方法2: 导航到官方播放页
      dbg("nav to: /tv/home?pid=" + pid);
      location.href = "/tv/home?pid=" + pid;
    } else {
      showSpin(false);
      toast("该频道暂不可用");
      return;
    }

    // 4s 兜底重试
    setTimeout(function () {
      if (window.__lptvCctvWeb.playUrl) return;
      const eff = window.__lptvCctvWeb.currentPid || pid;
      const b2 = findOfficialButton(officialNameOf(eff));
      if (b2) b2.click();
    }, 4000);
  }

  // 替换全局 switchChannel
  window.switchChannel = switchChannelDom;
  window.__lptvCctvWeb.switchChannel = switchChannelDom;

  /* ── 拖拽守卫 ──────────────────────────────────────────────────── */

  const DRAG_GUARD_SEL = "#lptv-controls,#lptv-vol,#lptv-panel,#lptv-epg," +
    "#lptv-settings,#lptv-toast,#lptv-lhint,#lptv-osd,#lptv-nextch,#lptv-digit,#lptv-rec-badge,input,select,button";

  function installDragGuard() {
    window.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      const t = e.target;
      if (t && t.closest && t.closest(DRAG_GUARD_SEL)) e.stopPropagation();
    }, true);
  }

  /* ── 启动增强 ──────────────────────────────────────────────────── */

  // 保存原 boot 并增强
  const _origBoot = typeof boot !== 'undefined' ? boot : null;

  function bootEnhanced() {
    installHlsHooks();
    installDragGuard();
    if (_origBoot) _origBoot();
    // 兜底: 15s 后强制淡出启动遮罩
    setTimeout(function() {
      const m = document.getElementById("lptv-bootmask");
      if (m) {
        try { m.style.transition = "opacity .6s"; m.style.opacity = "0"; } catch(e) {}
        setTimeout(function() { if (m.parentNode) m.parentNode.removeChild(m); }, 700);
      }
    }, 15000);
    if (window.__lptvCctvWeb.video && !window.__lptvCctvWeb.video.paused) showOSD("00", "正在接入直播…", true);
  }

  // 替换全局 boot
  window.boot = bootEnhanced;

  /* ── 导出公共 API ──────────────────────────────────────────────── */

  window.__lptvCctvWeb.acquireOfficial = acquireOfficial;
  window.__lptvCctvWeb.styleOfficial = styleOfficial;
  window.__lptvCctvWeb.bindVideoEvents = bindVideoEvents;
  window.__lptvCctvWeb.installHlsHooks = installHlsHooks;
  window.__lptvCctvWeb.harvestOfficial = harvestOfficial;
  window.__lptvCctvWeb.findOfficialButton = findOfficialButton;
  window.__lptvCctvWeb.onPlayUrl = onPlayUrl;
  window.__lptvCctvWeb.tryPlay = tryPlay;
})();
