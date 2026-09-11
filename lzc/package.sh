#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── 版本号：LPK_VERSION 环境变量 > git tag > package.json ───────────────────
LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"                          # 去掉 v 前缀，如 v1.1.0 → 1.1.0
if [ -z "$LPK_TAG" ]; then
  LPK_TAG=$(git -C "$PROJECT_ROOT" describe --tags --abbrev=0 2>/dev/null \
            | sed 's/^v//' || true)
fi
VERSION="${LPK_TAG:-$(node -p "require('${PROJECT_ROOT}/package.json').version")}"
echo "Packaging version: $VERSION"

# ── 始终写入正确的 package.yml（含当前版本号）────────────────────────────────
# build.sh 在本地模式下会重写此文件；CI 模式下需提前写入，避免使用旧版本
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

# ── 构建内容 ────────────────────────────────────────────────────────────────
if [ "${CI:-false}" != "true" ]; then
  echo "Running build.sh (local mode)..."
  bash "$SCRIPT_DIR/build.sh"
fi

# ── 调用 lzc-cli 打包 ─────────────────────────────────────────────────────
# CI 和本地模式均使用 lzc-build.yml（含 buildscript），由 build.sh 负责构建
BUILD_CFG="${LPK_BUILD_CONFIG:-lzc-build.yml}"

echo "Using build config: $BUILD_CFG"

LPK_NAME="cloud.lazycat.app.lptv-${VERSION}.lpk"
CLI_BIN="lzc-cli"

if ! command -v "$CLI_BIN" &>/dev/null; then
  echo "Error: lzc-cli not found in PATH. Install with: npm install -g @lazycatcloud/lzc-cli"
  exit 1
fi

(
  cd "$SCRIPT_DIR"
  "$CLI_BIN" project release \
    -f "$BUILD_CFG" \
    -o "$LPK_NAME"
)

if [ -f "$SCRIPT_DIR/$LPK_NAME" ]; then
  echo "Done: $SCRIPT_DIR/$LPK_NAME"
  ls -lh "$SCRIPT_DIR/$LPK_NAME"
else
  echo "Error: failed to create $LPK_NAME"
  exit 1
fi
