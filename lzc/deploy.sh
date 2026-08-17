#!/bin/bash
set -euo pipefail

# LazyBox LPTV Deployment Script
# Usage: ./deploy.sh [box-name]
# Example: ./deploy.sh jinglebaby.heiyu.space
#
# Prerequisites:
#   - Network access to the box (same LAN or SSH tunnel)
#   - lzc-cli installed: npm install -g @lazycatcloud/lzc-cli
#   - Box configured: lzc-cli box add-by-ssh <user> <host>
#
# If remote install fails due to network, download and install manually:
#   wget https://github.com/sikenali/LPTV/releases/latest/download/cloud.lazycat.app.lptv-<version>.lpk
#   lzc-cli lpk install cloud.lazycat.app.lptv-<version>.lpk

BOX="${1:-$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box default 2>/dev/null || echo '')}"

if [ -z "$BOX" ]; then
  echo "Error: No box specified and no default box found."
  echo ""
  echo "Available boxes:"
  node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box list 2>/dev/null || true
  echo ""
  echo "Usage: $0 <box-name>"
  echo "  e.g. $0 jinglebaby.heiyu.space"
  exit 1
fi

echo "Deploying to box: $BOX"

# Get latest release
echo "Fetching latest release from GitHub..."
LATEST=$(curl -fsSL https://api.github.com/repos/sikenali/LPTV/releases/latest)
TAG=$(echo "$LATEST" | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")
VERSION="${TAG#v}"
LPK_NAME="cloud.lazycat.app.lptv-${VERSION}.lpk"
LPK_URL="https://github.com/sikenali/LPTV/releases/download/${TAG}/${LPK_NAME}"

echo "Latest version: $TAG"
echo "LPK: $LPK_NAME"

# Download LPK
TMPFILE=$(mktemp /tmp/lptv.XXXXXX.lpk)
echo "Downloading $LPK_URL ..."
if ! curl -fsSL "$LPK_URL" -o "$TMPFILE"; then
  echo "Error: Failed to download LPK"
  rm -f "$TMPFILE"
  exit 1
fi
echo "Downloaded: $TMPFILE ($(du -h "$TMPFILE" | cut -f1))"

# Install to box
echo "Installing to box '$BOX' ..."
if node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js lpk install "$TMPFILE" 2>&1; then
  rm -f "$TMPFILE"
  echo "Deployment successful!"
else
  echo ""
  echo "Installation failed (box may be unreachable from this network)."
  echo ""
  echo "Manual installation steps:"
  echo "  1. Transfer the LPK to the box:"
  echo "     scp $TMPFILE <user>@<box-ip>:/tmp/"
  echo ""
  echo "  2. Install on the box:"
  echo "     lzc-cli lpk install /tmp/$LPK_NAME"
  echo ""
  echo "  Or download directly on the box:"
  echo "     wget -O /tmp/$LPK_NAME '$LPK_URL'"
  echo "     lzc-cli lpk install /tmp/$LPK_NAME"
  rm -f "$TMPFILE"
  exit 1
fi

