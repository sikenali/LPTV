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
import json
import logging
import os
import re
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

import aiohttp
from aiohttp import web
import aiohttp_cors

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("lptv-proxy")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
RECORD_DIR = BASE_DIR / "records"
SHOT_DIR = BASE_DIR / "shots"
RECORD_DIR.mkdir(exist_ok=True)
SHOT_DIR.mkdir(exist_ok=True)

OFFICIAL_URL = "https://www.yangshipin.cn/tv/home"
CAPI_BASE = "https://capi.yangshipin.cn"

# 内存状态
_state: dict = {
    "favs": [],
    "lastPid": "",
    "resumeLast": True,
    "res": [],
}

# 记录进行中的录制
_recorders: dict = {}


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
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Type",
}


# ── 页面抓取 + 注入 ───────────────────────────────────────────────

async def fetch_official(session: aiohttp.ClientSession, pid: str = "") -> str:
    url = OFFICIAL_URL
    if pid:
        url += ("&" if "?" in url else "?") + "pid=" + pid
    async with session.get(url, headers=_HEADERS, ssl=False, allow_redirects=True) as resp:
        return await resp.text(encoding="utf-8")


def rewrite_api_domains(html: str) -> str:
    """将所有官方 CAPI/CSAPI 域名替换为本地代理路径，确保 iframe 内同源请求"""
    # 按域名长度降序替换，避免短域名匹配错误
    replacements = [
        ("https://touchsystest.yangshipin.cn", "/capi"),
        ("https://appdevteamtest.yangshipin.cn", "/capi"),
        ("https://precapi.yangshipin.cn", "/capi"),
        ("https://precsapi.yangshipin.cn", "/capi"),
        ("https://csapi.yangshipin.cn", "/capi"),
        ("https://capi.yangshipin.cn", "/capi"),
        ("https://preoms.video.cloud.cctv.com", "/capi"),
    ]
    for old, new in replacements:
        html = html.replace(old, new)
    return html


def inject_into_html(html: str, css_url: str, js_url: str) -> str:
    """在首段<script>前注入 CAPI 重写脚本, 在 </head> 前注入 CSS, 在 </body> 前注入业务 JS"""
    head_close = "</head>"
    body_close = "</body>"
    first_script = html.find("<script")

    css_tag = f'\n<link rel="stylesheet" href="{css_url}">\n'

    # CAPI 重写脚本：必须在任何官方脚本之前执行, 拦截所有 capi.yangshipin.cn 请求
    capi_patch = '<script>(function(){'
    capi_patch += 'console.log("[lptv] CAPI patch loaded");'
    capi_patch += 'var _fetch=window.fetch;window.fetch=function(u,o){'
    capi_patch += 'if(typeof u==="string"&&u.indexOf("capi.yangshipin.cn")===0){console.log("[lptv] fetch patched: "+u);u="/capi"+u.replace("https://capi.yangshipin.cn","");}return _fetch(u,o);};'
    capi_patch += 'var _XH=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,*r){'
    capi_patch += 'if(typeof u==="string"&&u.indexOf("capi.yangshipin.cn")===0){console.log("[lptv] XHR patched: "+u);u="/capi"+u.replace("https://capi.yangshipin.cn","");}'
    capi_patch += '_XH.call(this,m,u,*r);};'
    capi_patch += '})();</script>\n'

    # 业务 JS：layer.js + patch.js
    js_tag = (f'\n<script src="{js_url}"></script>\n'
              f'<script src="{js_url.replace("layer.js", "patch.js")}"></script>\n')

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


# ── CAPI 透传 ──────────────────────────────────────────────────────

# Mock protobuf response for config API (requires authentication)
_CONFIG_MOCK = bytes.fromhex('08c80112140a05312e302e301201311a06e68890e58a9f')

async def proxy_capi(session: aiohttp.ClientSession, path: str) -> web.Response:
    target = CAPI_BASE + path
    try:
        async with session.get(target, headers=_HEADERS, ssl=False) as resp:
            body = await resp.read()
            ct = resp.content_type or "application/octet-stream"
            # Mock config response if API returns minimal data
            if path.endswith("/config") and len(body) <= 20:
                body = _CONFIG_MOCK
                ct = "application/octet-stream"
            if "json" in ct:
                try:
                    data = json.loads(body)
                    return web.Response(
                        body=json.dumps(data).encode(),
                        content_type=ct,
                        headers=_CORS_HEADERS,
                    )
                except Exception:
                    pass
            return web.Response(body=body, content_type=ct, headers=_CORS_HEADERS)
    except Exception as e:
        log.warning("capi proxy failed: %s → %s", path, e)
        return web.Response(text=f"CAPI error: {e}", status=502)


# ── API: 状态 ──────────────────────────────────────────────────────

async def api_get_state(req: web.Request) -> web.Response:
    return web.json_response({"ok": True, **_state})


async def api_set_state(req: web.Request) -> web.Response:
    body = await req.json()
    for key in ("favs", "lastPid", "resumeLast", "res"):
        if key in body:
            _state[key] = body[key]
    return web.json_response({"ok": True})


# ── API: 录制 ──────────────────────────────────────────────────────

async def api_rec_open(req: web.Request) -> web.Response:
    body = await req.json()
    channel = body.get("channel", "直播")
    rid = str(int(time.time() * 1000))
    fpath = RECORD_DIR / f"{rid}.webm"
    fh = open(fpath, "wb")
    _recorders[rid] = {"channel": channel, "fh": fh, "start": time.time(), "fname": fpath.name}
    log.info("rec open: rid=%s ch=%s → %s", rid, channel, fpath)
    return web.json_response({"ok": True, "id": rid})


async def api_rec_append(req: web.Request) -> web.Response:
    body = await req.json()
    rid = body.get("id")
    b64 = body.get("data", "")
    rec = _recorders.get(rid)
    if not rec:
        return web.json_response({"ok": False, "error": "rid not found"}, status=404)
    data = base64.b64decode(b64)
    rec["fh"].write(data)
    return web.json_response({"ok": True, "size": len(data)})


async def api_rec_close(req: web.Request) -> web.Response:
    body = await req.json()
    rid = body.get("id")
    rec = _recorders.pop(rid, None)
    if not rec:
        return web.json_response({"ok": False, "error": "rid not found"}, status=404)
    rec["fh"].close()
    size_mb = rec["fh"].tell() / 1048576 if hasattr(rec["fh"], "tell") else 0
    log.info("rec close: rid=%s (%.1f MB)", rid, size_mb)
    return web.json_response({"ok": True, "path": str(rec["fname"]), "size_mb": round(size_mb, 1)})


# ── API: 截图 ──────────────────────────────────────────────────────

async def api_shot_save(req: web.Request) -> web.Response:
    body = await req.json()
    channel = body.get("channel", "直播")
    b64 = body.get("data", "")
    img_data = base64.b64decode(b64)
    ts = time.strftime("%Y%m%d-%H%M%S")
    safe_name = re.sub(r"[^\w\-]", "_", channel)[:20]
    fname = f"{safe_name}-{ts}.png"
    fpath = SHOT_DIR / fname
    fpath.write_bytes(img_data)
    log.info("shot save: %s (%d bytes)", fname, len(img_data))
    return web.json_response({"ok": True, "name": fname})


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


def _parse_channel_list(raw: bytes) -> list:
    """解析 tvchannel/list protobuf 响应，返回频道列表"""
    channels = []
    i = 0
    inner_data = None
    # 外层: f1=状态码(varint), f2=数据(len), f3=成功消息(len)
    while i < len(raw):
        tag, i = _pb_read_varint(raw, i)
        if tag == 0:
            break
        field = tag >> 3
        wtype = tag & 7
        if wtype == 0:
            _, i = _pb_read_varint(raw, i)
        elif wtype == 2:
            val, i = _pb_read_len(raw, i)
            if field == 2:
                inner_data = val
        else:
            break

    if not inner_data:
        return channels

    # 内层: 重复的频道条目
    i = 0
    while i < len(inner_data):
        tag, i = _pb_read_varint(inner_data, i)
        if tag == 0:
            break
        field = tag >> 3
        wtype = tag & 7
        if wtype == 2:
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
                    _pb_read_varint(val, ji)
                    break
            name = ch.get('f1', '')
            pid = ch.get('f2', '')
            if name and pid:
                channels.append({"channelId": pid, "name": name})
        else:
            _, i = _pb_read_varint(inner_data, i)

    return channels


# ── API: 频道列表 ──────────────────────────────────────────────────

async def api_get_channels(req: web.Request) -> web.Response:
    """从官方 capi 拉取频道列表 (protobuf)"""
    session: aiohttp.ClientSession = req.app["session"]
    try:
        async with session.get(
            "https://capi.yangshipin.cn/api/oms/m/tvchannel/list",
            headers=_HEADERS, ssl=False
        ) as resp:
            raw = await resp.read()
            channel_list = _parse_channel_list(raw)
            # 转换格式适配前端
            channels = []
            for c in channel_list:
                name = c.get("name", "")
                if "限免" in name or "VIP" in name:
                    continue
                cat = "地方"
                if name.startswith("CGTN"):
                    cat = "CGTN"
                elif name.startswith("CCTV") or "4K" in name or "8K" in name:
                    cat = "央视"
                elif "教育" in name:
                    cat = "其他"
                elif "卫视" in name:
                    cat = "卫视"
                channels.append({
                    "channelId": c.get("channelId", ""),
                    "channelName": name,
                    "name": name,
                    "category": cat,
                })
            return web.json_response({"code": 0, "data": {"channelList": channels}})
    except Exception as e:
        log.warning("get_channels failed: %s", e)
        return web.json_response({"code": -1, "msg": str(e)})


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

    proxy_base = f"{req.scheme}://{req.host}".rstrip("/")
    html = inject_into_html(
        html,
        css_url=proxy_base + "/ui.css",
        js_url=proxy_base + "/layer.js",
    )
    return web.Response(text=html, content_type="text/html", charset="utf-8")


async def handle_proxy_video(req: web.Request) -> web.Response:
    url = req.query.get("url", "")
    if not url:
        return web.Response(text="missing ?url= parameter", status=400)
    session: aiohttp.ClientSession = req.app["session"]
    return await proxy_video(session, url)


async def handle_proxy_capi(req: web.Request) -> web.Response:
    # /capi/{rest_of_path}
    if "path" in req.match_info:
        path = req.match_info["path"]
        if not path.startswith("/"):
            path = "/" + path
    else:
        path = req.path
        if path.startswith("/capi"):
            path = path[5:]  # Remove /capi prefix
        if not path.startswith("/"):
            path = "/" + path
    # 确保路径以 /api 开头
    if not path.startswith("/api"):
        path = "/api" + path
    session: aiohttp.ClientSession = req.app["session"]
    return await proxy_capi(session, path)


async def on_startup(app: web.Application):
    connector = aiohttp.TCPConnector(ssl=False, limit=128, force_close=False)
    app["session"] = aiohttp.ClientSession(connector=connector)


async def on_cleanup(app: web.Application):
    await app["session"].close()
    for rid, rec in list(_recorders.items()):
        try:
            rec["fh"].close()
        except Exception:
            pass
    log.info("closed %d recorders", len(_recorders))


def build_app() -> web.Application:
    app = web.Application()

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

    # 静态文件 + 兜底代理：本地存在则直出，否则转发给官方并改写域名
    async def handle_static(req: web.Request) -> web.Response:
        session: aiohttp.ClientSession = req.app["session"]
        file_path = STATIC_DIR / req.path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            return web.FileResponse(file_path)
        # 优先从 www.yangshipin.cn（TV主站）获取，fallback 到 m.yangshipin.cn
        for base in ("https://www.yangshipin.cn", "https://m.yangshipin.cn"):
            target_url = base + req.path
            try:
                async with session.get(target_url, headers=_HEADERS, ssl=False,
                                        timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    body = await resp.read()
                    if resp.status != 404:
                        ct = resp.content_type or "application/octet-stream"
                        # 改写 JS/HTML 中的官方 API 域名为本地代理路径
                        text = body.decode("utf-8", errors="ignore")
                        text = rewrite_api_domains(text)
                        body = text.encode("utf-8")
                        return web.Response(
                            body=body,
                            content_type=ct,
                            headers={**_CORS_HEADERS, "Cache-Control": "public, max-age=3600"},
                        )
            except Exception:
                pass
        log.warning("static not found: %s", req.path)
        return web.Response(text="Not found", status=404)

    app.router.add_get("/{path:.*}", handle_static)

    # 生命周期
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    # CORS (所有端点)
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
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
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址 (default: 0.0.0.0)")
    args = parser.parse_args()

    app = build_app()
    log.info("LPTV Web starting on http://%s:%d", args.host, args.port)
    log.info("  打开浏览器访问: http://localhost:%d/_page", args.port)
    web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
