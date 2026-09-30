"""
LPTV Web — 薄同源代理 (路线 A)
用法:  python proxy/server.py [--port 9100]

架构:
  浏览器 ←同源→ 代理(:9100) ←HTTPS→ 央视频官方
                 ├─ GET /_page      抓官方页, 注入 layer.js/ui.css
                 ├─ GET /capi/*     透传 capi (CORS)
                 ├─ GET /proxy-video 代理视频分片 (添加 CORS, 使 canvas 不污染)
                 └─ POST /api/*     状态/录制/截图
"""

import asyncio
import base64
import binascii
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path

import aiohttp
from aiohttp import web
import aiohttp_cors

from epg import parse_epg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("lptv-proxy")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = (BASE_DIR / "static").resolve()

# 数据目录: 优先 DATA_DIR (LPK 注入), 否则回落到仓库内 ./data
DATA_DIR = Path(os.environ.get("DATA_DIR") or (BASE_DIR / "data")).resolve()
RECORD_DIR = DATA_DIR / "records"
SHOT_DIR = DATA_DIR / "shots"
STATE_FILE = DATA_DIR / "state.json"
for _d in (DATA_DIR, RECORD_DIR, SHOT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

OFFICIAL_URL = "https://www.yangshipin.cn/tv/home"
CAPI_BASE = "https://capi.yangshipin.cn"

# 单次请求体上限 (base64 编码后), 防止 OOM
MAX_BODY_BYTES = 32 * 1024 * 1024
# 单次 append 的裸数据上限
MAX_CHUNK_BYTES = 8 * 1024 * 1024

# 状态白名单
_STATE_KEYS = ("favs", "lastPid", "resumeLast", "res", "volume", "muted")
_state: dict = {
    "favs": [],
    "lastPid": "",
    "resumeLast": True,
    "res": [],
    "volume": 100,
    "muted": False,
}

# 记录进行中的录制
_recorders: dict = {}

# TTL 缓存: key -> (过期时间戳, 响应体 bytes, content_type)
_cache: dict = {}


def _state_load() -> None:
    try:
        if STATE_FILE.is_file():
            data = json.loads(STATE_FILE.read_text("utf-8"))
            if isinstance(data, dict):
                for k in _STATE_KEYS:
                    if k in data:
                        _state[k] = data[k]
    except Exception as e:
        log.warning("state load failed: %s", e)


def _state_save() -> None:
    try:
        tmp = STATE_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
        tmp.replace(STATE_FILE)
    except Exception as e:
        log.warning("state save failed: %s", e)


_state_load()



# ── 通用请求头 ─────────────────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.yangshipin.cn/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

_CORS_HEADERS = {
    # Origin 由 aiohttp_cors 统一负责, 此处只补充暴露头, 避免写出重复的
    # Access-Control-Allow-Origin (与 allow_credentials 冲突)
    "Access-Control-Expose-Headers": "Content-Length, Content-Type",
}

# 官方 API/CSAPI 域名 → 本地代理前缀 (按长度降序, 避免短域名误匹配)
_API_DOMAINS = [
    "https://touchsystest.yangshipin.cn",
    "https://appdevteamtest.yangshipin.cn",
    "https://precapi.yangshipin.cn",
    "https://precsapi.yangshipin.cn",
    "https://csapi.yangshipin.cn",
    "https://capi.yangshipin.cn",
    "https://preoms.video.cloud.cctv.com",
]


# ── 页面抓取 + 注入 ───────────────────────────────────────────────

async def fetch_official(session: aiohttp.ClientSession, pid: str = "") -> str:
    url = OFFICIAL_URL
    if pid:
        url += ("&" if "?" in url else "?") + "pid=" + pid
    async with session.get(url, headers=_HEADERS, ssl=False, allow_redirects=True) as resp:
        return await resp.text(encoding="utf-8")


def rewrite_api_domains(html: str) -> str:
    """将所有官方 CAPI/CSAPI 域名替换为本地代理路径，确保 iframe 内同源请求"""
    for old in _API_DOMAINS:
        html = html.replace(old, "/capi")
    return html


# 注入到官方页首段 <script> 之前的 CAPI 重写脚本。
# 必须做两件事, 缺一不可:
#   1) 覆盖全部 7 个官方 API 域名 (不只是 capi.yangshipin.cn)
#   2) 剥掉紧跟域名后的前导 "/api" —— 代理路由是 "/capi/{path}" → CAPI_BASE + "/api/" + {path},
#      若不剥, 官方 https://capi.yangshipin.cn/api/oms/... 会变成 /capi/api/oms/... → /api/api/oms/...
_CAPI_PATCH_JS = """(function(){
var DOMAINS=%s;
function toLocal(u){
  if(u && typeof u.url==="string") u=u.url;          // Request 对象
  else if(u && typeof u.href==="string") u=u.href;   // URL 对象
  if(typeof u!=="string") return u;
  for(var i=0;i<DOMAINS.length;i++){
    if(u.indexOf(DOMAINS[i])!==0) continue;
    var p=u.slice(DOMAINS[i].length);
    p=p.replace(/^\\/api(?=\\/|$)/,"");               // 关键: 去掉前导 /api
    return "/capi"+p;
  }
  return u;
}
var _f=window.fetch;
window.fetch=function(u,o){var n=toLocal(u);if(typeof n==="string"&&n!==u)u=n;return _f.call(this,u,o);};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){var n=toLocal(u);if(typeof n==="string"&&n!==u)u=n;return XO.apply(this,arguments);};
})();""" % json.dumps(_API_DOMAINS)


def inject_into_html(html: str, css_url: str, js_url: str) -> str:
    """在首段<script>前注入 CAPI 重写脚本, 在 </head> 前注入 CSS, 在 </body> 前注入业务 JS"""
    head_close = "</head>"
    body_close = "</body>"
    first_script = html.find("<script")

    css_tag = f'\n<link rel="stylesheet" href="{css_url}">\n'
    capi_patch = f"<script>{_CAPI_PATCH_JS}</script>\n"

    # 业务 JS: api.js + state.js (layer.js 依赖 LptvApi/LptvState) + layer.js
    # 注: 旧 patch.js 已删除 — 它是独立 IIFE, 引用 layer.js 私有符号全部 ReferenceError
    base = js_url.rsplit("/", 1)[0]
    js_tag = "\n" + "".join(
        f'<script src="{base}/{name}"></script>\n'
        for name in ("api.js", "state.js", "layer.js")
    )

    # CAPI 补丁注入到第一个 <script> 之前, 确保早于所有官方脚本执行
    if first_script > 0:
        html = html[:first_script] + capi_patch + html[first_script:]
    else:
        # 无 script 标签则注入到 </head> 前
        if head_close in html:
            html = html.replace(head_close, capi_patch + head_close, 1)
        else:
            html = capi_patch + html

    if head_close in html:
        html = html.replace(head_close, css_tag + head_close, 1)
    else:
        html = css_tag + html

    if body_close in html:
        html = html.replace(body_close, js_tag + body_close, 1)
    else:
        html += js_tag

    return html


# ── 视频分片代理 ───────────────────────────────────────────────────

async def proxy_video(session: aiohttp.ClientSession, url: str) -> web.Response:
    """代理 HLS/DASH 视频分片, 添加 CORS 头使其同源可用"""
    try:
        async with session.get(url, headers=_HEADERS, ssl=False,
                                timeout=aiohttp.ClientTimeout(total=15)) as resp:
            body = await resp.read()
            ct = resp.content_type or "application/octet-stream"
            return web.Response(
                body=body,
                content_type=ct,
                headers={**_CORS_HEADERS, "Cache-Control": "public, max-age=30"},
            )
    except Exception as e:
        log.warning("video proxy failed: %s → %s", url[:80], e)
        return web.Response(text=f"Video proxy error: {e}", status=502)


# ── 通用工具 ────────────────────────────────────────────────────────

async def read_json(req: web.Request, max_bytes: int = MAX_BODY_BYTES):
    """读取并解析 JSON 请求体, 统一返回 (ok, body_or_error_response)"""
    if req.content_length and req.content_length > max_bytes:
        return False, web.json_response(
            {"ok": False, "error": "payload too large"}, status=413)
    try:
        raw = await req.read()
    except Exception as e:
        return False, web.json_response({"ok": False, "error": f"read failed: {e}"}, status=400)
    if len(raw) > max_bytes:
        return False, web.json_response(
            {"ok": False, "error": "payload too large"}, status=413)
    try:
        body = json.loads(raw)
    except Exception:
        return False, web.json_response({"ok": False, "error": "invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return False, web.json_response({"ok": False, "error": "JSON object required"}, status=400)
    return True, body


def decode_b64(value: str, max_bytes: int = MAX_CHUNK_BYTES):
    """解码 base64, 返回 (ok, data_or_error_response)"""
    if not isinstance(value, str) or not value:
        return False, web.json_response({"ok": False, "error": "missing data"}, status=400)
    try:
        data = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as e:
        return False, web.json_response({"ok": False, "error": f"bad base64: {e}"}, status=400)
    if len(data) > max_bytes:
        return False, web.json_response(
            {"ok": False, "error": "chunk too large"}, status=413)
    return True, data


def cache_get(key: str):
    hit = _cache.get(key)
    if not hit:
        return None
    expires, body, ct = hit
    if expires < time.time():
        _cache.pop(key, None)
        return None
    return body, ct


def cache_put(key: str, body: bytes, ct: str, ttl: float) -> None:
    if len(_cache) > 256:
        now = time.time()
        for k in [k for k, v in _cache.items() if v[0] < now]:
            _cache.pop(k, None)
    _cache[key] = (time.time() + ttl, body, ct)


# ── CAPI 透传 ──────────────────────────────────────────────────────

async def proxy_capi(session: aiohttp.ClientSession, path: str) -> web.Response:
    hit = cache_get("capi:" + path)
    if hit is not None:
        body, ct = hit
        return web.Response(body=body, content_type=ct, headers=_CORS_HEADERS)
    target = CAPI_BASE + path
    try:
        async with session.get(target, headers=_HEADERS, ssl=False) as resp:
            body = await resp.read()
            ct = resp.content_type or "application/octet-stream"
            if "json" in ct:
                try:
                    data = json.loads(body)
                    body = json.dumps(data).encode()
                except Exception:
                    pass
            elif resp.status == 200:
                cache_put("capi:" + path, body, ct, 300)
            return web.Response(body=body, content_type=ct, headers=_CORS_HEADERS)
    except Exception as e:
        log.warning("capi proxy failed: %s → %s", path, e)
        return web.Response(text=f"CAPI error: {e}", status=502)


# ── API: 状态 ──────────────────────────────────────────────────────

async def api_get_state(req: web.Request) -> web.Response:
    return web.json_response({"ok": True, **_state})


async def api_set_state(req: web.Request) -> web.Response:
    ok, body = await read_json(req)
    if not ok:
        return body
    changed = False
    for key in _STATE_KEYS:
        if key in body:
            _state[key] = body[key]
            changed = True
    if changed:
        _state_save()
    return web.json_response({"ok": True})


# ── API: 录制 ──────────────────────────────────────────────────────

async def api_rec_open(req: web.Request) -> web.Response:
    ok, body = await read_json(req)
    if not ok:
        return body
    channel = str(body.get("channel", "直播"))[:40]
    # 毫秒时间戳会在同毫秒并发时撞 id 并泄漏文件句柄, 改用 uuid
    rid = uuid.uuid4().hex[:16]
    fpath = RECORD_DIR / f"{rid}.webm"
    try:
        fh = open(fpath, "wb")
    except OSError as e:
        log.error("rec open failed: %s", e)
        return web.json_response({"ok": False, "error": f"cannot open file: {e}"}, status=500)
    _recorders[rid] = {"channel": channel, "fh": fh, "start": time.time(),
                       "fname": fpath.name, "written": 0}
    log.info("rec open: rid=%s ch=%s → %s", rid, channel, fpath)
    return web.json_response({"ok": True, "id": rid})


async def api_rec_append(req: web.Request) -> web.Response:
    ok, body = await read_json(req)
    if not ok:
        return body
    rid = body.get("id")
    rec = _recorders.get(rid)
    if not rec:
        return web.json_response({"ok": False, "error": "rid not found"}, status=404)
    ok, data = decode_b64(body.get("data", ""))
    if not ok:
        return data
    try:
        rec["fh"].write(data)
    except OSError as e:
        log.error("rec append write failed: rid=%s %s", rid, e)
        return web.json_response({"ok": False, "error": f"write failed: {e}"}, status=500)
    rec["written"] += len(data)
    return web.json_response({"ok": True, "size": rec["written"]})


async def api_rec_close(req: web.Request) -> web.Response:
    ok, body = await read_json(req)
    if not ok:
        return body
    rid = body.get("id")
    rec = _recorders.pop(rid, None)
    if not rec:
        return web.json_response({"ok": False, "error": "rid not found"}, status=404)
    fh = rec["fh"]
    # 必须在 close() 之前取 size: 关闭后的文件对象调用 tell() 抛
    # ValueError: I/O operation on closed file, 而 hasattr 守卫无效
    try:
        size = fh.tell()
    except Exception:
        size = rec.get("written", 0)
    try:
        fh.close()
    except OSError as e:
        log.warning("rec close error: rid=%s %s", rid, e)
    size_mb = size / 1048576
    log.info("rec close: rid=%s %s (%.1f MB)", rid, rec["fname"], size_mb)
    return web.json_response({"ok": True, "path": rec["fname"], "size_mb": round(size_mb, 1)})

    log.info("rec close: rid=%s (%.1f MB)", rid, size_mb)
    return web.json_response({"ok": True, "path": str(rec["fname"]), "size_mb": round(size_mb, 1)})


# ── API: 截图 ──────────────────────────────────────────────────────

async def api_shot_save(req: web.Request) -> web.Response:
    ok, body = await read_json(req)
    if not ok:
        return body
    channel = str(body.get("channel", "直播"))[:40]
    ok, img_data = decode_b64(body.get("data", ""), max_bytes=16 * 1024 * 1024)
    if not ok:
        return img_data
    ts = time.strftime("%Y%m%d-%H%M%S")
    safe_name = re.sub(r"[^\w\-]", "_", channel)[:20] or "shot"
    fname = f"{safe_name}-{ts}.png"
    fpath = SHOT_DIR / fname
    try:
        fpath.write_bytes(img_data)
    except OSError as e:
        log.error("shot save failed: %s", e)
        return web.json_response({"ok": False, "error": f"write failed: {e}"}, status=500)
    log.info("shot save: %s (%d bytes)", fname, len(img_data))
    return web.json_response({"ok": True, "name": fname, "path": str(fpath)})


# ── Protobuf 解析 ──────────────────────────────────────────────────

def _pb_read_varint(data, i):
    result = 0
    shift = 0
    for _ in range(5):
        if i >= len(data):
            break
        b = data[i]
        i += 1
        result |= (b & 0x7f) << shift
        shift += 7
        if not (b & 0x80):
            break
    return result, i


def _pb_read_len(data, i):
    length, i = _pb_read_varint(data, i)
    return data[i:i + length], i + length


def _pb_skip(data, i, wtype):
    """按 wire type 跳过一个字段, 返回新的游标"""
    if wtype == 0:
        return _pb_read_varint(data, i)[1]
    if wtype == 1:
        return i + 8
    if wtype == 2:
        length, i = _pb_read_varint(data, i)
        return i + length
    if wtype == 5:
        return i + 4
    return i  # wtype 3/4 (group) 在本协议中不出现


def _parse_channel_list(raw: bytes) -> list:
    """解析 tvchannel/list protobuf 响应，返回频道列表"""
    channels = []
    inner_data = None
    # 外层: f1=状态码(varint), f2=数据(len), f3=成功消息(len)
    i = 0
    while i < len(raw):
        tag, i = _pb_read_varint(raw, i)
        if tag == 0:
            break
        field = tag >> 3
        wtype = tag & 7
        if wtype == 2:
            val, i = _pb_read_len(raw, i)
            if field == 2:
                inner_data = val
        else:
            i = _pb_skip(raw, i, wtype)

    if not inner_data:
        return channels

    # 内层: 重复的频道条目 (f1=台名, f2=pid)
    i = 0
    while i < len(inner_data):
        tag, i = _pb_read_varint(inner_data, i)
        if tag == 0:
            break
        wtype = tag & 7
        if wtype != 2:
            i = _pb_skip(inner_data, i, wtype)
            continue
        val, i = _pb_read_len(inner_data, i)
        ch = {}
        ji = 0
        while ji < len(val):
            jtag, ji = _pb_read_varint(val, ji)
            if jtag == 0:
                break
            jfield = jtag >> 3
            jwtype = jtag & 7
            if jwtype == 0:
                jval, ji = _pb_read_varint(val, ji)
                ch[f'f{jfield}'] = jval
            elif jwtype == 2:
                jval, ji = _pb_read_len(val, ji)
                try:
                    ch[f'f{jfield}'] = jval.decode('utf-8')
                except Exception:
                    ch[f'f{jfield}'] = jval.hex()
            else:
                # 原实现在此丢弃 varint 返回值且不推进游标, 导致解析中断
                ji = _pb_skip(val, ji, jwtype)
        name = ch.get('f1', '')
        pid = ch.get('f2', '')
        if name and pid:
            channels.append({"channelId": pid, "name": name})
    return channels


def infer_category(name: str) -> str:
    """频道分类 —— 三个前端的唯一权威实现"""
    if name.startswith("CGTN"):
        return "CGTN"
    if name.startswith("CCTV") or "4K" in name or "8K" in name:
        return "央视"
    if "卫视" in name:
        return "卫视"
    if "教育" in name:
        return "其他"
    return "地方"


# ── API: 频道列表 ──────────────────────────────────────────────────

CHANNELS_URL = CAPI_BASE + "/api/oms/m/tvchannel/list"
EPG_URL_TMPL = CAPI_BASE + "/api/yspepg/program/{pid}/{ymd}"
CHANNELS_TTL = 3600.0
EPG_TTL = 300.0


async def api_get_channels(req: web.Request) -> web.Response:
    """从官方 capi 拉取频道列表 (protobuf) 并转成前端约定的 JSON 结构"""
    session: aiohttp.ClientSession = req.app["session"]
    hit = cache_get("channels")
    if hit is not None:
        return web.Response(body=hit[0], content_type=hit[1])
    try:
        async with session.get(CHANNELS_URL, headers=_HEADERS, ssl=False) as resp:
            raw = await resp.read()
            if resp.status != 200:
                log.warning("get_channels upstream status=%s (%d bytes)",
                            resp.status, len(raw))
                return web.json_response(
                    {"code": -1, "msg": f"upstream HTTP {resp.status}"}, status=502)
            channel_list = _parse_channel_list(raw)
            channels = []
            for c in channel_list:
                name = c.get("name", "")
                if "限免" in name or "VIP" in name:
                    continue
                channels.append({
                    "channelId": c.get("channelId", ""),
                    "channelName": name,
                    "name": name,
                    "category": infer_category(name),
                })
            payload = {"code": 0, "data": {"channelList": channels}}
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            cache_put("channels", body, "application/json", CHANNELS_TTL)
            log.info("get_channels: %d channels", len(channels))
            return web.Response(body=body, content_type="application/json")
    except Exception as e:
        log.warning("get_channels failed: %s", e)
        # 原实现返回 HTTP 200 + code:-1, 前端无法区分"空列表"与"拉取失败"
        return web.json_response({"code": -1, "msg": str(e)}, status=502)


# ── API: EPG 节目单 ────────────────────────────────────────────────

async def api_get_epg(req: web.Request) -> web.Response:
    """代理官方 EPG protobuf 接口并解析为 JSON, 供两个前端共用"""
    pid = (req.match_info.get("pid") or "").strip()
    ymd = (req.match_info.get("ymd") or "").strip()
    if not re.fullmatch(r"[0-9A-Za-z_-]{1,32}", pid or ""):
        return web.json_response({"code": -1, "msg": "bad pid"}, status=400)
    if not re.fullmatch(r"[0-9]{8}", ymd):
        return web.json_response({"code": -1, "msg": "bad ymd (YYYYMMDD)"}, status=400)
    # 日历合法性: 光看 8 位数字会放过 20261340 这种月份 13 的值
    month = (int(ymd) // 100) % 100
    day = int(ymd) % 100
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return web.json_response({"code": -1, "msg": "bad ymd (not a real date)"}, status=400)

    session: aiohttp.ClientSession = req.app["session"]
    key = f"epg:{pid}:{ymd}"
    hit = cache_get(key)
    if hit is not None:
        return web.Response(body=hit[0], content_type=hit[1])

    target = EPG_URL_TMPL.format(pid=pid, ymd=ymd)
    try:
        async with session.get(target, headers=_HEADERS, ssl=False) as resp:
            raw = await resp.read()
            if resp.status != 200:
                return web.json_response(
                    {"code": -1, "msg": f"upstream HTTP {resp.status}"}, status=502)
    except Exception as e:
        log.warning("epg fetch failed: %s → %s", target, e)
        return web.json_response({"code": -1, "msg": str(e)}, status=502)

    programs = parse_epg(raw)
    body = json.dumps(
        {"code": 0, "data": {"pid": pid, "ymd": ymd, "programs": programs}},
        ensure_ascii=False,
    ).encode("utf-8")
    cache_put(key, body, "application/json", EPG_TTL)
    return web.Response(body=body, content_type="application/json")


# ── 路由 ───────────────────────────────────────────────────────────

async def handle_page(req: web.Request) -> web.Response:
    """抓取官方页并注入我们的 JS/CSS"""
    pid = req.query.get("pid", "")
    session: aiohttp.ClientSession = req.app["session"]
    try:
        html = await fetch_official(session, pid)
        html = rewrite_api_domains(html)
    except Exception as e:
        log.error("fetch_official failed: %s", e)
        return web.Response(
            text=f"<h1>无法连接官方直播页: {e}</h1><p>请确认网络可达 https://www.yangshipin.cn</p>",
            status=502,
        )

    # LPK/nginx 反代后, req.scheme/host 是内网地址, 注入的绝对 URL 会指向错误主机
    scheme = req.headers.get("X-Forwarded-Proto") or req.scheme
    host = req.headers.get("X-Forwarded-Host") or req.host
    proxy_base = f"{scheme}://{host}".rstrip("/")
    html = inject_into_html(
        html,
        css_url=proxy_base + "/ui.css",
        js_url=proxy_base + "/layer.js",
    )
    return web.Response(text=html, content_type="text/html", charset="utf-8",
                        headers={"Cache-Control": "no-cache"})


async def handle_proxy_video(req: web.Request) -> web.Response:
    url = req.query.get("url", "")
    if not url:
        return web.Response(text="missing ?url= parameter", status=400)
    session: aiohttp.ClientSession = req.app["session"]
    return await proxy_video(session, url)


async def handle_proxy_capi(req: web.Request) -> web.Response:
    # 路由为 /capi/{path:.*}, 目标是 CAPI_BASE + "/api/" + {path}
    # 前端与注入的 CAPI patch 都遵循 "/capi/<不含 /api 前缀>" 约定
    path = "/api/" + req.match_info.get("path", "")
    session: aiohttp.ClientSession = req.app["session"]
    return await proxy_capi(session, path)


async def handle_health(req: web.Request) -> web.Response:
    return web.json_response({
        "ok": True,
        "recorders": len(_recorders),
        "cached": len(_cache),
    })


async def on_startup(app: web.Application):
    connector = aiohttp.TCPConnector(ssl=False, limit=128, force_close=False)
    app["session"] = aiohttp.ClientSession(connector=connector)
    app["client_max_size"] = MAX_BODY_BYTES


async def on_cleanup(app: web.Application):
    await app["session"].close()
    for rid, rec in list(_recorders.items()):
        try:
            rec["fh"].close()
        except Exception:
            pass
    log.info("closed %d recorders", len(_recorders))
    _state_save()


def build_app() -> web.Application:
    app = web.Application(client_max_size=MAX_BODY_BYTES)

    app.router.add_get("/health", handle_health)

    # 页面
    app.router.add_get("/_page", handle_page)

    # 视频代理 (关键: 让 canvas drawImage 不跨域污染)
    app.router.add_get("/proxy-video", handle_proxy_video)

    # CAPI 透传
    app.router.add_get("/capi/{path:.*}", handle_proxy_capi)

    # API
    app.router.add_get("/api/state", api_get_state)
    app.router.add_post("/api/state", api_set_state)
    app.router.add_post("/api/record/open", api_rec_open)
    app.router.add_post("/api/record/append", api_rec_append)
    app.router.add_post("/api/record/close", api_rec_close)
    app.router.add_post("/api/shot", api_shot_save)
    app.router.add_get("/api/channels", api_get_channels)
    app.router.add_get("/api/epg/{pid}/{ymd}", api_get_epg)

    # 静态文件 + 兜底代理：本地存在则直出，否则转发给官方并改写域名
    _TEXTUAL = ("text/", "application/javascript", "application/json",
                "application/xml", "+json", "+xml")

    async def handle_static(req: web.Request) -> web.Response:
        session: aiohttp.ClientSession = req.app["session"]
        # 目录穿越防护: 必须 resolve 后确认仍在 STATIC_DIR 之内
        try:
            file_path = (STATIC_DIR / req.path.lstrip("/")).resolve()
            inside = file_path == STATIC_DIR or STATIC_DIR in file_path.parents
        except (OSError, ValueError):
            inside = False
            file_path = None
        if inside and file_path.is_file():
            return web.FileResponse(file_path)
        if req.path.startswith("/api/") or req.path.startswith("/capi/"):
            # 未匹配的 API 路径不应被转发到官方站点
            return web.json_response({"ok": False, "error": "not found"}, status=404)
        # 优先从 www.yangshipin.cn（TV主站）获取，fallback 到 m.yangshipin.cn
        for base in ("https://www.yangshipin.cn", "https://m.yangshipin.cn"):
            target_url = base + req.path
            try:
                async with session.get(target_url, headers=_HEADERS, ssl=False,
                                        timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    body = await resp.read()
                    if resp.status != 404:
                        ct = resp.content_type or "application/octet-stream"
                        headers = {**_CORS_HEADERS, "Cache-Control": "public, max-age=3600"}
                        # 只有文本资源才做域名改写; 旧实现对所有响应体做 UTF-8
                        # 解码重编码, 图片/字体/视频被静默破坏
                        if any(t in ct for t in _TEXTUAL):
                            body = rewrite_api_domains(
                                body.decode("utf-8", errors="replace")).encode("utf-8")
                        return web.Response(body=body, content_type=ct, headers=headers)
            except Exception:
                pass
        log.warning("static not found: %s", req.path)
        return web.Response(text="Not found", status=404)

    app.router.add_get("/{path:.*}", handle_static)

    # 生命周期
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    # CORS (所有端点)
    # allow_credentials 必须为 False: 浏览器拒绝 "Allow-Origin: *" 与凭证并存,
    # 且本服务无鉴权, 开启凭证等于邀请跨站请求写入 /api/record/* 与 /api/shot
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=False,
            expose_headers="*",
            allow_headers="*",
        )
    })
    for route in list(app.router.routes()):
        cors.add(route)

    return app


def main():
    import argparse
    parser = argparse.ArgumentParser(description="LPTV Web Proxy")
    parser.add_argument("--port", type=int, default=9100, help="监听端口 (default: 9100)")
    parser.add_argument("--host", default="127.0.0.1",
                        help="绑定地址 (default: 127.0.0.1; 局域网访问需显式传 0.0.0.0)")
    args = parser.parse_args()

    app = build_app()
    log.info("LPTV Web starting on http://%s:%d", args.host, args.port)
    log.info("  打开浏览器访问: http://localhost:%d/_page", args.port)
    log.info("  数据目录: %s", DATA_DIR)
    web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
