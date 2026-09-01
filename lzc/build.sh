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
cp "$PROJECT_ROOT/scripts/node-ipc.cjs" "$SCRIPT_DIR/_lpk_content/scripts/node-ipc.cjs" 2>/dev/null || true

# ── CEF runtime: copy binary + shared lib + resources into scripts/ ──────────
CEF_DEMO_DIR="$PROJECT_ROOT/lptv-cef-demo"
CEF_BIN_SRC="$CEF_DEMO_DIR/src/main.cpp"
CEF_TMP_BIN="$(mktemp -d)/lptv-cef-demo"
CEF_SCRIPTS_DIR="$SCRIPT_DIR/_lpk_content/scripts"

# Build CEF binary locally if cmake available
if command -v cmake >/dev/null 2>&1 && [ -f "$CEF_BIN_SRC" ]; then
  echo "Building CEF binary..."
  (cd "$CEF_DEMO_DIR" && \
    mkdir -p build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release >/dev/null 2>&1 && \
    cmake --build . -j$(nproc) 2>/dev/null) && \
    [ -f "$CEF_DEMO_DIR/build/lptv-cef-demo" ] && \
    cp "$CEF_DEMO_DIR/build/lptv-cef-demo" "$CEF_TMP_BIN" && \
    chmod +x "$CEF_TMP_BIN" && \
    echo "CEF binary built: $(ls -lh "$CEF_TMP_BIN" | awk '{print $5}')" || \
    echo "WARNING: CEF binary build failed (non-fatal), CEF playback disabled"
fi

# Copy libcef.so and resources from local CEF demo dir (must exist locally)
CEF_LIB_SRC="$CEF_DEMO_DIR/third_party/libcef/libcef.so"
if [ -f "$CEF_LIB_SRC" ]; then
  cp "$CEF_LIB_SRC" "$CEF_SCRIPTS_DIR/libcef.so"
  # Copy CEF resources (.pak, icudtl.dat, locales/)
  cp "$CEF_DEMO_DIR/third_party/libcef/chrome_100_percent.pak" "$CEF_SCRIPTS_DIR/" 2>/dev/null || true
  cp "$CEF_DEMO_DIR/third_party/libcef/chrome_200_percent.pak" "$CEF_SCRIPTS_DIR/" 2>/dev/null || true
  cp "$CEF_DEMO_DIR/third_party/libcef/resources.pak" "$CEF_SCRIPTS_DIR/" 2>/dev/null || true
  cp "$CEF_DEMO_DIR/third_party/libcef/icudtl.dat" "$CEF_SCRIPTS_DIR/" 2>/dev/null || true
  cp -r "$CEF_DEMO_DIR/third_party/libcef/locales" "$CEF_SCRIPTS_DIR/" 2>/dev/null || true
  echo "CEF runtime copied: libcef.so + resources ($(du -sh "$CEF_SCRIPTS_DIR" | awk '{print $1}'))"
else
  echo "WARNING: libcef.so not found at $CEF_LIB_SRC — CEF playback will not work"
  echo "  Copy from WPS: cp /opt/kingsoft/wps-office/office6/addons/cef/libcef.so $CEF_LIB_SRC"
  # Still copy the built binary if it exists
  if [ -f "${CEF_TMP_BIN:-}" ]; then
    cp "${CEF_TMP_BIN}" "$CEF_SCRIPTS_DIR/lptv-cef-demo"
    chmod +x "$CEF_SCRIPTS_DIR/lptv-cef-demo"
  fi
fi
[ -n "${CEF_TMP_BIN}" ] && rm -rf "${CEF_TMP_BIN}"

cp "$SCRIPT_DIR/backend-package.json" "$SCRIPT_DIR/_lpk_content/package.json"
cp -f "$PROJECT_ROOT/logos/"*.png "$SCRIPT_DIR/_lpk_content/logos/" 2>/dev/null || true

cat > "$SCRIPT_DIR/_lpk_content/scripts/start.sh" << 'STARTSCRIPT'
#!/bin/sh
set -e

mkdir -p /app/data /app/logs
chmod -R 777 /app/data || true

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

LPTV_CEF_BIN=/lzcapp/pkg/content/scripts/lptv-cef-demo \
  LD_LIBRARY_PATH=/lzcapp/pkg/content/scripts:$LD_LIBRARY_PATH \
  node /lzcapp/pkg/content/scripts/proxy-server.cjs >>/app/logs/backend.log 2>&1 &
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
