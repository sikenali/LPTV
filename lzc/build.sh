#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"
VERSION="${LPK_TAG:-$(cd "$PROJECT_ROOT" && git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || true)}"
VERSION="${VERSION:-1.0.0}"
echo "Building version: $VERSION"

cat > "$SCRIPT_DIR/package.yml" <<PKGEOF
package: cloud.lazycat.app.lptv
version: ${VERSION}
name: LPTV
description: LPTV，支持 IPTV 直播频道播放，内置 M3U 源解析与流媒体代理
author: sikenali
license: MIT
homepage: https://github.com/sikenali/lptv
min_os_version: 1.5.0
unsupported_platforms:
  - ios
locales:
  zh-CN:
    name: LPTV
    description: LPTV，支持 IPTV 直播频道播放
  en:
    name: LPTV
    description: IPTV live channel player with M3U source parsing and stream proxy
permissions:
  required:
    - net.internet
runtime: node
runtime_version: "20"
PKGEOF

rm -rf "$SCRIPT_DIR/_lpk_content"
mkdir -p "$SCRIPT_DIR/_lpk_content/frontend"
mkdir -p "$SCRIPT_DIR/_lpk_content/scripts"
mkdir -p "$SCRIPT_DIR/_lpk_content/channels"
mkdir -p "$SCRIPT_DIR/_lpk_content/logos"

cp "$SCRIPT_DIR/icon.png" "$SCRIPT_DIR/_lpk_content/icon.png"

(cd "$PROJECT_ROOT" && npm run build)

cp -a "$PROJECT_ROOT/dist/." "$SCRIPT_DIR/_lpk_content/frontend/"

cp "$PROJECT_ROOT/scripts/proxy-server.cjs" "$SCRIPT_DIR/_lpk_content/scripts/proxy-server.cjs"
cp -f "$PROJECT_ROOT/channels/lptv.m3u8" "$SCRIPT_DIR/_lpk_content/channels/lptv.m3u8" 2>/dev/null || true
cp -f "$PROJECT_ROOT/logos/"*.png "$SCRIPT_DIR/_lpk_content/logos/" 2>/dev/null || true

cat > "$SCRIPT_DIR/_lpk_content/scripts/start-server.sh" << 'RUNNER'
#!/bin/sh
exec node /lzcapp/pkg/content/scripts/proxy-server.cjs
RUNNER
chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start-server.sh"

(
  cd "$SCRIPT_DIR/_lpk_content/frontend"
  for f in *.html; do
    case "$f" in
      index.html|404.html) continue ;;
    esac
    name="${f%.html}"
    if [ -n "$name" ]; then
      mkdir -p "$name"
      cp "$f" "$name/index.html"
    fi
  done
)

cat > "$SCRIPT_DIR/_lpk_content/scripts/start.sh" << 'STARTSCRIPT'
#!/bin/sh
set -e

mkdir -p /app/data /app/logs
chmod -R 777 /app/data || true

/lzcapp/pkg/content/scripts/start-server.sh >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 30); do
  sleep 2
  if wget -qO- http://127.0.0.1:$BACKEND_PORT/health >/dev/null 2>&1; then
    echo "backend healthy after ${i}x2s"
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "backend exited with code $?, logs:"
    cat /app/logs/backend.log
    exit 1
  fi
done

while kill -0 $BACKEND_PID 2>/dev/null; do
  sleep 2
done

echo "container stopped: backend=$BACKEND_PID"
echo "=== backend log ==="
cat /app/logs/backend.log
exit 0
STARTSCRIPT

chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start.sh"
