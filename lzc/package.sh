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

CLI_BIN="/usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js"
(
  cd "$(dirname "$0")"
  $CLI_BIN project release -o output.lpk
)

if [ -f output.lpk ]; then
  mv output.lpk "$LPK_NAME"
  echo "Done: $LPK_NAME"
fi
