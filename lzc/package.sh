#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"
if [ -z "$LPK_TAG" ]; then
  LPK_TAG=$(git -C "$(dirname "$0")/.." describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || true)
fi
# 注意: 这里必须在 if 外面赋值。原代码把 VERSION/LPK_NAME 放在 if 内，
# 一旦 LPK_VERSION 有值就直接 `set -u` 报 unbound variable。
VERSION="${LPK_TAG:-1.0.0}"
LPK_NAME="cloud.lazycat.app.lptv-${VERSION}.lpk"
echo "Packaging version: $VERSION"

# Step 1: Run build.sh via bash (works on Windows via Git Bash)
bash "$(dirname "$0")/build.sh"

# Step 2: Create temp build config without buildscript (skip re-run)
cat > "$SCRIPT_DIR/lzc-build-no-buildscript.yml" << 'EOF'
icon: ./icon.png
manifest: ./lzc-manifest.yml
contentdir: _lpk_content
pkgout: ./
EOF

CLI_BIN=$(npm root -g)/@lazycatcloud/lzc-cli/scripts/cli.js
if [ ! -f "$CLI_BIN" ]; then
  CLI_BIN=$(which lzc-cli 2>/dev/null || echo "")
fi
if [ -z "$CLI_BIN" ] || [ ! -f "$CLI_BIN" ]; then
  echo "Error: lzc-cli not found"
  exit 1
fi

# 注意: 必须在 lzc/ 目录内用 `.` 作为 context 运行。
# lzc-cli 会把 build 配置里的相对路径再拼一层 context，
# 传 `lzc` 会去找 lzc/lzc/lzc-manifest.yml 而 ENOENT。
# pkgout 用 `./` 而不是 ./output.lpk：后者在部分版本下不会落盘。
rm -f "$SCRIPT_DIR/$LPK_NAME"
(
  cd "$SCRIPT_DIR"
  node "$CLI_BIN" project build . --file lzc-build-no-buildscript.yml
)

rm -f "$SCRIPT_DIR/lzc-build-no-buildscript.yml"

# lzc-cli 按 package.yml 的 version 命名产物
BUILT="$SCRIPT_DIR/cloud.lazycat.app.lptv-v${VERSION}.lpk"
if [ -f "$BUILT" ]; then
  mv "$BUILT" "$SCRIPT_DIR/$LPK_NAME"
  echo "Done: $LPK_NAME"
else
  echo "Error: expected artifact not found: $BUILT"
  ls -l "$SCRIPT_DIR"/*.lpk 2>/dev/null || true
  exit 1
fi
