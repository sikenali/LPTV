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
description: LPTV，Web端的频道直播工具
author: sikenali
license: MIT
homepage: https://github.com/sikenali/lptv
min_os_version: 1.5.0
unsupported_platforms:
  - ios
locales:
  zh-CN:
    name: 懒猫微视
    description: 懒猫微视，IPTV 直播频道聚合播放，内置多源聚合、自动测速与流媒体代理，NAS 端的在线直播工具
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

cp "$SCRIPT_DIR/icon.png" "$SCRIPT_DIR/_lpk_content/icon.png"

# 构建前端 (Vue)
(cd "$PROJECT_ROOT" && npm run build)

# 复制前端构建产物到 LPK 内容目录
cp -a "$PROJECT_ROOT/dist/." "$SCRIPT_DIR/_lpk_content/frontend/"

# 复制 proxy-server.cjs 到前端目录 (作为静态文件供 Node 后端加载)
cp "$PROJECT_ROOT/scripts/proxy-server.cjs" "$SCRIPT_DIR/_lpk_content/frontend/proxy-server.cjs"

# 创建后端启动脚本
cat > "$SCRIPT_DIR/_lpk_content/scripts/start-backend.sh" << 'RUNNER'
#!/bin/sh
set -e

export LZC_APP=1
export NODE_PATH="/lzcapp/pkg/content/node_modules"

# 启动 Node.js 代理
exec node /lzcapp/pkg/content/frontend/proxy-server.cjs
RUNNER
chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start-backend.sh"

# 创建主启动脚本
cat > "$SCRIPT_DIR/_lpk_content/scripts/start.sh" << 'STARTSCRIPT'
#!/bin/sh
set -e

mkdir -p /app/data /app/logs
chmod -R 777 /app/data || true

# 启动后端代理
/lzcapp/pkg/content/scripts/start-backend.sh >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!

# 等待健康检查
for i in $(seq 1 30); do
  sleep 1
  if wget -qO- http://127.0.0.1:$BACKEND_PORT/health >/dev/null 2>&1; then
    echo "backend healthy after ${i}s"
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "backend exited with code $?, logs:"
    cat /app/logs/backend.log
    exit 1
  fi
done

# 保持容器运行
wait $BACKEND_PID
exit 0
STARTSCRIPT
chmod +x "$SCRIPT_DIR/_lpk_content/scripts/start.sh"

echo "Build completed successfully"
