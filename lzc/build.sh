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
    - display.graphics
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

# Copy lptv (TV dedicated interface) - use as main frontend if exists
if [ -d "$PROJECT_ROOT/lptv" ]; then
    cp -a "$PROJECT_ROOT/lptv/." "$SCRIPT_DIR/_lpk_content/frontend/lptv/"
    # Use lptv/index.html as the main entry point
    cp "$PROJECT_ROOT/lptv/index.html" "$SCRIPT_DIR/_lpk_content/frontend/index.html"
fi

cp "$PROJECT_ROOT/scripts/proxy-server.cjs" "$SCRIPT_DIR/_lpk_content/scripts/proxy-server.cjs"
cp "$PROJECT_ROOT/cef-framework/resources/channels.html" "$SCRIPT_DIR/_lpk_content/scripts/channels.html" 2>/dev/null || true
cp "$PROJECT_ROOT/cef-framework/resources/channels.json" "$SCRIPT_DIR/_lpk_content/scripts/channels.json" 2>/dev/null || true
cp "$SCRIPT_DIR/backend-package.json" "$SCRIPT_DIR/_lpk_content/package.json"
# Copy scripts/data (channel streams data)
if [ -d "$PROJECT_ROOT/scripts/data" ]; then
    cp -a "$PROJECT_ROOT/scripts/data/" "$SCRIPT_DIR/_lpk_content/scripts/data/"
    echo "Data copied: $(ls "$SCRIPT_DIR/_lpk_content/scripts/data/" | wc -l) files"
fi
cp -f "$PROJECT_ROOT/logos/"*.png "$SCRIPT_DIR/_lpk_content/logos/" 2>/dev/null || true

# ── CEF runtime: expand libcef.so.xz → libcef.so + copy resources ────────────
CEF_DEMO_DIR="$PROJECT_ROOT/cef-framework"
CEF_LIB_SRC="$CEF_DEMO_DIR/third_party/libcef/libcef.so"
CEF_LIB_SRC_XZ="${CEF_LIB_SRC}.xz"
CEF_SCRIPTS_DIR="$SCRIPT_DIR/_lpk_content/scripts"

# 从 .xz 压缩文件解压 libcef.so（CI 和本地均适用）
if [ ! -f "$CEF_LIB_SRC" ] && [ -f "$CEF_LIB_SRC_XZ" ]; then
  echo "Expanding libcef.so.xz → libcef.so ..."
  python3 -c "import lzma,sys; data=lzma.decompress(open(sys.argv[1],'rb').read()); open(sys.argv[2],'wb').write(data)" \
    "$CEF_LIB_SRC_XZ" "$CEF_LIB_SRC"
  echo "libcef.so expanded: $(ls -lh "$CEF_LIB_SRC" | awk '{print $5}')"
fi

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
  echo "ERROR: libcef.so not found at $CEF_LIB_SRC — CEF playback will not work"
  exit 1
fi

# ── 打包 CEF 二进制 cef-tv → cef-bin ──────────────────────────────────────────
CEF_BIN_SRC="$CEF_DEMO_DIR/build/cef-tv"
CEF_BIN_SRC_XZ="${CEF_BIN_SRC}.xz"
if [ ! -f "$CEF_BIN_SRC" ] && [ -f "$CEF_BIN_SRC_XZ" ]; then
  echo "Expanding cef-tv.xz → cef-tv ..."
  python3 -c "import lzma,sys; data=lzma.decompress(open(sys.argv[1],'rb').read()); open(sys.argv[2],'wb').write(data)" \
    "$CEF_BIN_SRC_XZ" "$CEF_BIN_SRC"
fi
if [ -f "$CEF_BIN_SRC" ]; then
  cp "$CEF_BIN_SRC" "$CEF_SCRIPTS_DIR/cef-bin"
  chmod +x "$CEF_SCRIPTS_DIR/cef-bin"
  echo "CEF binary copied: $(ls -lh "$CEF_SCRIPTS_DIR/cef-bin" | awk '{print $5}')"
else
  echo "WARNING: cef-tv binary not found at $CEF_BIN_SRC — CEF playback disabled"
fi

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

LPTV_CEF_BIN=/lzcapp/pkg/content/scripts/cef-bin \
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
