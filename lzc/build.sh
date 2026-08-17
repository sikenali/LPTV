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
PKGEOF

rm -rf "$SCRIPT_DIR/_lpk_content"
mkdir -p "$SCRIPT_DIR/_lpk_content/backend"
mkdir -p "$SCRIPT_DIR/_lpk_content/frontend"
mkdir -p "$SCRIPT_DIR/_lpk_content/scripts"

cp "$SCRIPT_DIR/icon.png" "$SCRIPT_DIR/_lpk_content/icon.png"

(cd "$PROJECT_ROOT" && npm run build)

cp -a "$PROJECT_ROOT/dist/." "$SCRIPT_DIR/_lpk_content/frontend/"

(cd "$PROJECT_ROOT/backend/cmd/proxy" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$SCRIPT_DIR/_lpk_content/backend/lptv-proxy" .)

mkdir -p "$SCRIPT_DIR/_lpk_content/backend/logos"
cp -f "$PROJECT_ROOT/lptv.m3u8" "$SCRIPT_DIR/_lpk_content/backend/lptv.m3u8" 2>/dev/null || true
cat > "$SCRIPT_DIR/_lpk_content/backend/run-server.sh" << 'RUNNER'
#!/bin/sh
exec /lzcapp/pkg/content/backend/lptv-proxy
RUNNER
chmod +x "$SCRIPT_DIR/_lpk_content/backend/run-server.sh"

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

/lzcapp/pkg/content/backend/run-server.sh >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 45); do
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
