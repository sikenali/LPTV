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

CLI_BIN=$(npm root -g)/@lazycatcloud/lzc-cli/scripts/cli.js
if [ ! -f "$CLI_BIN" ]; then
  CLI_BIN=$(which lzc-cli 2>/dev/null || echo "")
  if [ -n "$CLI_BIN" ]; then
    CLI_BIN="$CLI_BIN"
  fi
fi
if [ -z "$CLI_BIN" ] || [ ! -f "$CLI_BIN" ]; then
  echo "Error: lzc-cli not found"
  exit 1
fi
(
  cd "$SCRIPT_DIR"
  BUILD_CFG="${LPK_BUILD_CONFIG:-lzc-build.yml}"
  echo "Using build config: $BUILD_CFG"
  node "$CLI_BIN" project release -f "$BUILD_CFG" -o output.lpk
)

if [ -f "$SCRIPT_DIR/output.lpk" ]; then
  mv "$SCRIPT_DIR/output.lpk" "$SCRIPT_DIR/$LPK_NAME"
  echo "Done: $LPK_NAME"
fi
