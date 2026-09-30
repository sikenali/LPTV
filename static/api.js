/**
 * LPTV Web — API 客户端
 *
 * Web 端调用方式:    LptvApi.getChannels()
 */

const LptvApi = (() => {
  const BASE = window.__LptvProxyBase || 'http://localhost:9100';

  async function _post(path, body) {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function _get(path) {
    const r = await fetch(BASE + path);
    return r.json();
  }

  return {
    getChannels: () => _get('/api/channels'),
    getState: () => _get('/api/state'),
    setState: (patch) => _post('/api/state', patch),
    recOpen: (channel) => _post('/api/record/open', { channel }),
    recAppend: (id, data) => _post('/api/record/append', { id, data }),
    recClose: (id) => _post('/api/record/close', { id }),
    shotSave: (channel, data) => _post('/api/shot', { channel, data }),
    fetchEpg: (pid, ymd) => _get(`/capi/yspepg/program/${pid}/${ymd}`),
    ready: true,
  };
})();
