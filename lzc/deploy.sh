#!/bin/bash
set -euo pipefail

# LazyBox LPTV Deployment Script
#
# Usage:
#   ./deploy.sh              # auto-detect box and deploy
#   ./deploy.sh <box-name>   # deploy to specific box
#
# How it works:
#   1. If running ON the LightOS box (hportal-client available) → direct install
#   2. If running in webshell container → download LPK, show install command for box terminal
#   3. If SSH access available → install via SSH tunnel
#
# Prerequisites:
#   - lzc-cli: npm install -g @lazycatcloud/lzc-cli
#   - GitHub access (for downloading LPK)

BOX="${1:-$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box default 2>/dev/null || echo '')}"

# Detect deployment mode
is_on_box=false
if [ -f /etc/lightos-release ]; then
  is_on_box=true
elif [ -d ~/.config/hportal-client ] && [ -f ~/.config/hportal-client/shellapi_addr ]; then
  is_on_box=true
fi

# Check if we're in a webshell container (can't reach box directly)
is_webshell_container=false
if ls /tmp/lcmd-webshell-agent-*.sock 2>/dev/null | grep -q . && ! is_on_box; then
  is_webshell_container=true
fi

# Get latest release info
get_latest_release() {
  curl -fsSL https://api.github.com/repos/sikenali/LPTV/releases/latest 2>/dev/null
}

# Download LPK, print path to stdout
download_lpk() {
  local version="$1"
  local tmpfile
  tmpfile=$(mktemp /tmp/lptv.XXXXXX.lpk)
  local lpk_name="cloud.lazycat.app.lptv-${version}.lpk"
  local url="https://github.com/sikenali/LPTV/releases/download/v${version}/${lpk_name}"
  if ! curl -fsSL "$url" -o "$tmpfile"; then
    rm -f "$tmpfile"
    return 1
  fi
  printf '%s' "$tmpfile"
}

echo "============================================"
echo "  LPTV Deployment Script"
echo "============================================"
echo ""

# Determine box
if [ -z "$BOX" ]; then
  echo "No box specified. Attempting auto-detection..."
  BOX=$(cat /proc/1/environ 2>/dev/null | tr '\0' '\n' | grep -E "^BOX_NAME=" | cut -d= -f2 || true)
  [ -z "$BOX" ] && BOX=$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box default 2>/dev/null || true)
fi

if [ -z "$BOX" ]; then
  echo "Error: No box configured."
  echo ""
  echo "Available boxes:"
  node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box list 2>/dev/null || true
  echo ""
  echo "Configure a box with:"
  echo "  lzc-cli box add-by-ssh <user> <host>"
  exit 1
fi

echo "Target box: $BOX"
if [ "$is_on_box" = true ]; then
  echo "Mode: Direct (on LightOS box)"
elif [ "$is_webshell_container" = true ]; then
  echo "Mode: Webshell container (will show install command for box terminal)"
else
  echo "Mode: Remote (attempting SSH)"
fi
echo ""

# Get latest version
echo "Fetching latest release from GitHub..."
LATEST=$(get_latest_release)
if [ -z "$LATEST" ]; then
  echo "Error: Failed to fetch latest release from GitHub"
  exit 1
fi

TAG=$(echo "$LATEST" | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")
VERSION="${TAG#v}"
LPK_NAME="cloud.lazycat.app.lptv-${VERSION}.lpk"
LPK_URL="https://github.com/sikenali/LPTV/releases/download/${TAG}/${LPK_NAME}"

echo "Latest version: $TAG"
echo "LPK: $LPK_NAME"
echo ""

# Download LPK
echo "Downloading LPK..."
TMPFILE=$(download_lpk "$VERSION") || { echo "Error: Failed to download LPK"; exit 1; }
echo "Downloaded: $(du -h "$TMPFILE" | cut -f1)"
echo ""

# Deploy based on mode
echo "Deploying..."
echo ""

if [ "$is_on_box" = true ]; then
  # Running directly on the LightOS box - install immediately
  if node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js lpk install "$TMPFILE" 2>&1; then
    rm -f "$TMPFILE"
    echo ""
    echo "✓ Deployment successful!"
    echo "  App: $LPK_NAME"
    echo "  Version: $VERSION"
    exit 0
  fi
  rm -f "$TMPFILE"
  exit 1

elif [ "$is_webshell_container" = true ]; then
  # In webshell container - provide install command for box terminal
  rm -f "$TMPFILE"
  echo "⚠ Running in webshell container (no direct box network access)."
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  Copy and run these commands in the LightOS box terminal:"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "  wget -O /tmp/$LPK_NAME '$LPK_URL'"
  echo "  lzc-cli lpk install /tmp/$LPK_NAME"
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "One-liner:"
  echo "  wget -O /tmp/$LPK_NAME '$LPK_URL' && lzc-cli lpk install /tmp/$LPK_NAME"
  echo ""
  exit 0

else
  # Remote mode - try direct install
  INSTALL_OUTPUT=$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js lpk install "$TMPFILE" 2>&1) || true
  echo "$INSTALL_OUTPUT"

  if echo "$INSTALL_OUTPUT" | grep -q "安装成功\|success\|installed"; then
    rm -f "$TMPFILE"
    echo ""
    echo "✓ Deployment successful!"
    exit 0
  fi

  rm -f "$TMPFILE"
  echo ""
  echo "⚠ Installation failed. Box may be unreachable."
  echo ""
  echo "Manual install on the box:"
  echo "  wget -O /tmp/$LPK_NAME '$LPK_URL'"
  echo "  lzc-cli lpk install /tmp/$LPK_NAME"
  exit 1
fi
