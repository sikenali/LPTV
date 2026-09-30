/**
 * LPTV Web — API 客户端
 *
 * Web 端调用方式:    LptvApi.getChannels()
 *
 * 注意: EPG 已改为服务端解析 (/api/epg/{pid}/{ymd} 返回 JSON),
 * 前端不再自行解 protobuf。
 */

const LptvApi = (() => {
  // 同源部署 (LPK) 时留空即可; 开发时用 ?proxy=http://localhost:9100 覆盖
  const BASE = window.__LptvProxyBase || '';

  async function _post(path, body, opts) {
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: (opts && opts.signal) || undefined,
    });
    return r.json();
  }

  async function _get(path, opts) {
    const r = await fetch(BASE + path, { signal: (opts && opts.signal) || undefined });
    return r.json();
  }

  return {
    getChannels: (opts) => _get('/api/channels', opts),
    getState: (opts) => _get('/api/state', opts),
    setState: (patch) => _post('/api/state', patch),
    recOpen: (channel) => _post('/api/record/open', { channel }),
    recAppend: (id, data) => _post('/api/record/append', { id, data }),
    recClose: (id) => _post('/api/record/close', { id }),
    shotSave: (channel, data) => _post('/api/shot', { channel, data }),
    // 服务端已解好 protobuf, 直接返回 { code, data: { programs: [...] } }
    fetchEpg: (pid, ymd, opts) => _get('/api/epg/' + encodeURIComponent(pid) + '/' + ymd, opts),
    ready: true,
  };
})();
