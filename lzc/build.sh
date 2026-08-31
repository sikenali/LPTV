#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"
VERSION="${LPK_TAG:-$(cd "$PROJECT_ROOT" && git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || true)}"
VERSION="${VERSION:-1.1.0}"
echo "Building version: $VERSION"

cat > "$SCRIPT_DIR/package.yml" <<PKGEOF
package: cloud.lazycat.app.lptv
version: ${VERSION}
name: LPTV
description: 懒猫微视 —— IPTV 直播频道播放，整页导航官方直播页
author: sikenali
license: MIT
homepage: https://github.com/sikenali/lptv
min_os_version: 1.5.0
unsupported_platforms:
  - ios
locales:
  zh-CN:
    name: 懒猫微视
    description: 懒猫微视 —— IPTV 直播频道播放
  en:
    name: LPTV
    description: LPTV - IPTV live channel player via official pages
permissions:
  required:
    - net.internet
runtime: node
runtime_version: "20"
PKGEOF

mkdir -p "$SCRIPT_DIR/_lpk_content"
find "$SCRIPT_DIR/_lpk_content" -mindepth 1 -delete
mkdir -p "$SCRIPT_DIR/_lpk_content/frontend"
mkdir -p "$SCRIPT_DIR/_lpk_content/scripts"
mkdir -p "$SCRIPT_DIR/_lpk_content/logos"

cp "$SCRIPT_DIR/icon.png" "$SCRIPT_DIR/_lpk_content/icon.png"

# Build React frontend
(cd "$PROJECT_ROOT" && npm run build)

cp -a "$PROJECT_ROOT/dist/." "$SCRIPT_DIR/_lpk_content/frontend/"

# Copy lptv (TV dedicated interface)
if [ -d "$PROJECT_ROOT/lptv" ]; then
    cp -a "$PROJECT_ROOT/lptv/." "$SCRIPT_DIR/_lpk_content/frontend/lptv/"
fi

cp "$PROJECT_ROOT/scripts/proxy-server.cjs" "$SCRIPT_DIR/_lpk_content/scripts/proxy-server.cjs"
cp "$SCRIPT_DIR/backend-package.json" "$SCRIPT_DIR/_lpk_content/package.json"
cp -f "$PROJECT_ROOT/logos/"*.png "$SCRIPT_DIR/_lpk_content/logos/" 2>/dev/null || true

cat > "$SCRIPT_DIR/_lpk_content/scripts/start-backend.sh" << 'RUNNER'
#!/bin/sh
BUNDLED_DEPS="/lzcapp/pkg/content/node_modules"
FALLBACK_NM="/tmp/lptv-node-modules"

if [ -d "$BUNDLED_DEPS" ]; then
  export NODE_PATH="$BUNDLED_DEPS"
else
  echo "[start] no bundled node_modules, installing..."
  if [ ! -d "$FALLBACK_NM" ]; then
    npm install --prefix "$FALLBACK_NM" express cors --production --loglevel=error 2>&1 || { echo "[start] FAILED to install deps"; exit 1; }
  fi
  export NODE_PATH="$FALLBACK_NM/node_modules"
fi
exec node /lzcapp/pkg/content/scripts/proxy-server.cjs
RUNNER
chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start-backend.sh"

# Pre-install backend deps into lpk
(
  cd "$SCRIPT_DIR/_lpk_content"
  if [ -f package.json ]; then
    npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 || exit 1
  fi
)

# Create SPA page redirects
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

/lzcapp/pkg/content/scripts/start-backend.sh >>/app/logs/backend.log 2>&1 &
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
