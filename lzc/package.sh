#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"
if [ -z "$LPK_TAG" ]; then
  LPK_TAG=$(git -C "$(dirname "$0")/.." describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || true)
fi
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
pkgout: ./output.lpk
EOF

CLI_BIN=$(npm root -g)/@lazycatcloud/lzc-cli/scripts/cli.js
if [ ! -f "$CLI_BIN" ]; then
  CLI_BIN=$(which lzc-cli 2>/dev/null || echo "")
fi
if [ -z "$CLI_BIN" ] || [ ! -f "$CLI_BIN" ]; then
  echo "Error: lzc-cli not found"
  exit 1
fi
(
  cd "$SCRIPT_DIR"
  node "$CLI_BIN" project release -o output.lpk --file lzc-build-no-buildscript.yml
)

rm -f "$SCRIPT_DIR/lzc-build-no-buildscript.yml"

if [ -f "$SCRIPT_DIR/output.lpk" ]; then
  mv "$SCRIPT_DIR/output.lpk" "$SCRIPT_DIR/$LPK_NAME"
  echo "Done: $LPK_NAME"
fi
