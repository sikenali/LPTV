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
# 將專為容器後端的 package.json 複製到部署包（只含 express/cors/m3u-parser-generator）
cp "$SCRIPT_DIR/backend-package.json" "$SCRIPT_DIR/_lpk_content/package.json"
cp -f "$PROJECT_ROOT/channels/lptv.m3u8" "$SCRIPT_DIR/_lpk_content/channels/lptv.m3u8" 2>/dev/null || true
# 如果本地 logos/ 为空，尝试从 GitHub 下载常用频道台标
if [ -z "$(ls -A "$PROJECT_ROOT/logos/" 2>/dev/null)" ]; then
  echo "[build] logos/ empty, fetching from GitHub..."
  node "$PROJECT_ROOT/scripts/fetch-logos.cjs" 2>/dev/null || true
fi
cp -f "$PROJECT_ROOT/logos/"*.png "$SCRIPT_DIR/_lpk_content/logos/" 2>/dev/null || true

cat > "$SCRIPT_DIR/_lpk_content/scripts/start-server.sh" << 'RUNNER'
#!/bin/sh
set -e

# 记录启动时间
echo "[start] $(date) - Starting server..."

# 若 node_modules 不存在則自動安裝依賴（容器首次啟動時執行）
if [ ! -d "/lzcapp/pkg/content/node_modules" ]; then
  echo "[start] Installing dependencies..."
  cd /lzcapp/pkg/content
  npm install --production --loglevel=verbose 2>&1 || {
    echo "[start] ERROR: npm install failed"
    exit 1
  }
  echo "[start] Dependencies installed successfully"
else
  echo "[start] node_modules exists, skipping npm install"
fi

# 检查端口是否在环境变量中
PORT="${PORT:-8080}"
echo "[start] Starting server on port $PORT..."

# 启动服务
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

echo "=== LPTV Container Start ==="
echo "Start time: $(date)"

mkdir -p /app/data /app/logs
chmod -R 777 /app/data || true

# 使用 BACKEND_PORT 或默认 8080
BACKEND_PORT="${BACKEND_PORT:-8080}"
echo "Backend port: $BACKEND_PORT"

# 启动后端服务（后台运行）
/lzcapp/pkg/content/scripts/start-server.sh >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 等待后端健康检查（最多 60 秒）
echo "Waiting for backend to be healthy..."
HEALTHY=0
for i in $(seq 1 30); do
  sleep 2
  if wget -qO- http://127.0.0.1:$BACKEND_PORT/health >/dev/null 2>&1; then
    echo "backend healthy after ${i}x2s"
    HEALTHY=1
    break
  fi
  # 检查进程是否还在运行
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "backend exited unexpectedly, logs:"
    cat /app/logs/backend.log 2>/dev/null || true
    exit 1
  fi
  # 每 10 秒打印一次进度
  if [ $((i % 5)) -eq 0 ]; then
    echo "waiting... ${i}x2s"
  fi
done

if [ $HEALTHY -eq 0 ]; then
  echo "backend health check failed after 60s"
  cat /app/logs/backend.log 2>/dev/null || true
  exit 1
fi

# 保持容器运行
while kill -0 $BACKEND_PID 2>/dev/null; do
  sleep 2
done

echo "container stopped: backend=$BACKEND_PID"
echo "=== backend log ==="
cat /app/logs/backend.log
exit 0
STARTSCRIPT

chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start.sh"
