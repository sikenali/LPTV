#!/bin/bash
set -euo pipefail

LPK_TAG="${LPK_VERSION:-}"
LPK_TAG="${LPK_TAG#v}"
if [ -z "$LPK_TAG" ]; then
  LPK_TAG=$(git -C "$(dirname "$0")/.." describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || true)
fi
VERSION="${LPK_TAG:-1.0.0}"
LPK_NAME="cloud.lazycat.app.lptv-${VERSION}.lpk"
echo "Packaging version: $VERSION"

bash "$(dirname "$0")/build.sh"

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
  cd "$(dirname "$0")"
  node "$CLI_BIN" project release -o output.lpk
)

if [ -f output.lpk ]; then
  mv output.lpk "$LPK_NAME"
  echo "Done: $LPK_NAME"
fi
