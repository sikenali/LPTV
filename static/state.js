/**
 * LPTV Web — 本地状态 (替代 pywebview.state)
 *
 * Web 端:    LptvState.sync(...)  → localStorage + 代理后端
 */

const LptvState = (() => {
  const KEY = 'lptv.cfg.v3';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }

  let _pending = null;
  let _timer = null;

  function flush(patch) {
    _pending = Object.assign(_pending || {}, patch);
    clearTimeout(_timer);
    _timer = setTimeout(async () => {
      const p = _pending;
      _pending = null;
      try { await LptvApi.setState(p); }
      catch (e) { console.warn('[LptvState] sync failed:', e); }
    }, 800);
  }

  return { load, save, flush };
})();
