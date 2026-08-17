#!/usr/bin/env python3
import os
import re
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import ssl
import hashlib
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PORT = int(os.environ.get('PORT', os.environ.get('BACKEND_PORT', '8080')))
LOCAL_M3U_PATH = os.path.join(os.path.dirname(__file__), 'local.m3u8')
M3U_URL = 'https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8'
CACHE_TTL = 4 * 60 * 60  # 4 hours
LOGO_DIR = os.path.join(os.path.dirname(__file__), 'logos')
STREAM_TIMEOUT = 30
MAX_CONCURRENT = 10
PROBE_TIMEOUT = 5
MAX_CONCURRENT_PROBE = 5

os.makedirs(LOGO_DIR, exist_ok=True)

cache = {'data': None, 'timestamp': 0}
active_streams = 0
pending_streams = []
stream_lock = threading.Lock()
active_lock = threading.Lock()


def parse_m3u(text):
    channels = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith('#EXTINF'):
            name = ''
            logo = ''
            group = '未分类'
            j = i + 1
            while j < len(lines) and lines[j].startswith('#'):
                attr = lines[j]
                m = re.search(r'tvg-name="([^"]+)"', attr)
                if m:
                    name = m.group(1)
                m = re.search(r'tvg-logo="([^"]+)"', attr)
                if m:
                    logo = m.group(1)
                m = re.search(r'group-title="([^"]+)"', attr)
                if m:
                    group = m.group(1)
                j += 1
            if j < len(lines) and lines[j].strip() and not lines[j].strip().startswith('#'):
                url = lines[j].strip()
                if name and url:
                    channels.append({
                        'id': f"{group}-{name}",
                        'name': name,
                        'logo': logo,
                        'group': group,
                        'url': url,
                    })
            i = j
        else:
            i += 1
    return channels


def probe_url(url, timeout=PROBE_TIMEOUT):
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.status < 400
    except Exception:
        return False


def filter_valid_channels(channels):
    results = [None] * len(channels)
    for i in range(0, len(channels), MAX_CONCURRENT_PROBE):
        batch = channels[i:i + MAX_CONCURRENT_PROBE]
        batch_results = []
        for ch in batch:
            valid = probe_url(ch['url'])
            batch_results.append(ch if valid else None)
        for j, r in enumerate(batch_results):
            results[i + j] = r
    return [c for c in results if c is not None]


def deduplicate_channels(channels):
    name_map = {}
    priority = {'央视频道': 0, '卫视频道': 1}
    for ch in channels:
        key = ch['name'].lower()
        if key not in name_map:
            name_map[key] = ch
        else:
            existing = name_map[key]
            ep = priority.get(existing['group'], 99)
            np = priority.get(ch['group'], 99)
            if np < ep:
                name_map[key] = ch
    return list(name_map.values())


def get_referer(url):
    try:
        parsed = urllib.parse.urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/"
    except Exception:
        return ''


def resolve_url(base, relative):
    if not relative:
        return ''
    if relative.startswith('http://') or relative.startswith('https://'):
        return relative
    if relative.startswith('//'):
        return urllib.parse.urljoin('https:', relative)
    return urllib.parse.urljoin(base, relative)


def rewrite_manifest(text, master_url):
    lines = text.split('\n')
    result = []
    for i, line in enumerate(lines):
        trimmed = line.strip()
        if not trimmed or trimmed.startswith('#'):
            if trimmed.startswith('#EXT-X-STREAM-INF') or trimmed.startswith('#EXT-X-MEDIA:'):
                next_line = lines[i + 1] if i + 1 < len(lines) else ''
                if next_line and not next_line.strip().startswith('#'):
                    resolved = resolve_url(master_url, next_line.strip())
                    if resolved.endswith('.m3u8') or 'm3u8' in resolved:
                        result.append(line)
                        result.append(f'/api/proxy/stream?url={urllib.parse.quote(resolved)}')
                        continue
            result.append(line)
            continue
        resolved = resolve_url(master_url, trimmed)
        result.append(f'/api/proxy/stream?url={urllib.parse.quote(resolved)}')
    return '\n'.join(result)


def generate_logo_svg(name):
    colors = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16']
    color = colors[hash(name) % len(colors)]
    letter = name[0].upper() if name else '?'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="12" fill="{color}" opacity="0.8"/>
  <text x="40" y="44" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="sans-serif">{letter}</text>
</svg>'''


class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'timestamp': time.time()}).encode())
            return

        if self.path == '/api/m3u':
            force_refresh = self.query_param('refresh') == '1'
            should_validate = self.query_param('validate') == 'true'
            now = time.time()
            if not force_refresh and not should_validate and cache['data'] and now - cache['timestamp'] < CACHE_TTL:
                self.json_response(cache['data'])
                return
            try:
                use_local = os.environ.get('USE_LOCAL_M3U') == 'true'
                if use_local and os.path.exists(LOCAL_M3U_PATH):
                    with open(LOCAL_M3U_PATH, 'r') as f:
                        text = f.read()
                else:
                    ctx = ssl.create_default_context()
                    req = urllib.request.Request(M3U_URL)
                    req.add_header('User-Agent', 'Mozilla/5.0')
                    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                        text = resp.read().decode('utf-8', errors='replace')
                channels = parse_m3u(text)
                if should_validate:
                    channels = filter_valid_channels(channels)
                    channels = deduplicate_channels(channels)
                cache['data'] = channels
                cache['timestamp'] = now
                self.json_response(channels)
            except Exception as e:
                if cache['data']:
                    self.json_response(cache['data'])
                else:
                    self.send_error(502)
            return

        if self.path.startswith('/api/proxy/stream'):
            parsed = urllib.parse.urlparse(self.path)
            stream_url = urllib.parse.parse_qs(parsed.query).get('url', [None])[0]
            quality = urllib.parse.parse_qs(parsed.query).get('quality', [''])[0]
            if not stream_url:
                self.send_error(400, 'Missing url')
                return
            self.handle_stream(stream_url, quality)
            return

        if self.path.startswith('/api/proxy/image'):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            img_url = params.get('url', [None])[0]
            name = params.get('name', [''])[0]
            if not img_url:
                self.send_error(400, 'Missing url')
                return
            self.handle_image(img_url, name)
            return

        self.send_error(404)

    def query_param(self, key):
        parsed = urllib.parse.urlparse(self.path)
        return urllib.parse.parse_qs(parsed.query).get(key, [''])[0]

    def json_response(self, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_stream(self, stream_url, quality):
        global active_streams
        with active_lock:
            if active_streams >= MAX_CONCURRENT:
                self.send_error(503, 'Too many streams')
                return
            active_streams += 1
        try:
            referer = get_referer(stream_url)
            ctx = ssl.create_default_context()
            req = urllib.request.Request(stream_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            req.add_header('Referer', referer)
            req.add_header('Origin', referer)
            with urllib.request.urlopen(req, timeout=STREAM_TIMEOUT, context=ctx) as resp:
                content_type = resp.headers.get('Content-Type', '') or ''
                is_m3u8 = 'mpegurl' in content_type or 'x-mpegurl' in content_type or stream_url.endswith('.m3u8')
                if is_m3u8:
                    text = resp.read().decode('utf-8', errors='replace')
                    if '#EXT-X-STREAM-INF' in text:
                        lines = text.split('\n')
                        variants = []
                        for i, line in enumerate(lines):
                            if line.strip().startswith('#EXT-X-STREAM-INF'):
                                url_line = lines[i + 1] if i + 1 < len(lines) else ''
                                if url_line and not url_line.strip().startswith('#'):
                                    resolved = resolve_url(stream_url, url_line.strip())
                                    bw_match = re.search(r'BANDWIDTH=(\d+)', line)
                                    res_match = re.search(r'RESOLUTION=(\d+)x(\d+)', line)
                                    bw = int(bw_match.group(1)) if bw_match else 0
                                    res = min(int(res_match.group(1)), int(res_match.group(2))) if res_match else 0
                                    variants.append({'url': resolved, 'bandwidth': bw, 'resolution': res})
                        if variants:
                            q_map = {'high': float('inf'), 'low': 0, '4k': 2160, '1080p': 1080, '720p': 720, '480p': 480}
                            target = q_map.get(quality.lower(), 0) if quality else 0
                            if target > 0:
                                matched = [v for v in variants if v['resolution'] == target]
                                chosen = sorted(matched, key=lambda x: -x['bandwidth'])[0] if matched else None
                            else:
                                chosen = sorted(variants, key=lambda x: -x['bandwidth'])[0]
                            if chosen:
                                new_url = f"/api/proxy/stream?url={urllib.parse.quote(chosen['url'])}"
                                if quality:
                                    new_url += f"&quality={quality}"
                                self.send_response(302)
                                self.send_header('Location', new_url)
                                self.end_headers()
                                return
                    rewritten = rewrite_manifest(text, stream_url)
                    body = rewritten.encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/vnd.apple.mpegurl')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', content_type or 'application/octet-stream')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    for h in ['Content-Length', 'Content-Range', 'Accept-Ranges']:
                        if resp.headers.get(h):
                            self.send_header(h, resp.headers.get(h))
                    self.end_headers()
                    while True:
                        chunk = resp.read(8192)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
        except Exception as e:
            self.send_error(502, str(e))
        finally:
            with active_lock:
                active_streams -= 1

    def handle_image(self, img_url, name):
        h = hashlib.md5(img_url.encode()).hexdigest()
        ext = Path(urllib.parse.urlparse(img_url).path).suffix or '.png'
        local_path = os.path.join(LOGO_DIR, h + ext)
        if os.path.exists(local_path):
            with open(local_path, 'rb') as f:
                body = f.read()
            ctype = 'image/svg+xml' if ext == '.svg' else 'image/jpeg' if ext in ('.jpg', '.jpeg') else 'image/png'
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        try:
            ctx = ssl.create_default_context()
            req = urllib.request.Request(img_url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
                body = resp.read()
            os.makedirs(LOGO_DIR, exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(body)
            ctype = resp.headers.get('Content-Type', 'image/png')
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            svg = generate_logo_svg(name)
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=86400')
            body = svg.encode('utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)


class ThreadedHTTPServer(HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def process_request(self, request, client_address):
        t = threading.Thread(target=self.process_request_thread, args=(request, client_address))
        t.daemon = True
        t.start()

    def process_request_thread(self, request, client_address):
        try:
            self.finish_request(request, client_address)
        except Exception:
            self.handle_error(request, client_address)
        finally:
            self.shutdown_request(request)


if __name__ == '__main__':
    server = ThreadedHTTPServer(('0.0.0.0', PORT), ProxyHandler)
    print(f'LPTV proxy server running on port {PORT}')
    server.serve_forever()
