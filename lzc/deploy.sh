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
#   2. If running in webshell container → download LPK, show install command for box
#   3. If SSH access available → install via SSH tunnel
#
# Prerequisites:
#   - lzc-cli: npm install -g @lazycatcloud/lzc-cli
#   - GitHub access (for downloading LPK)

BOX="${1:-$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js box default 2>/dev/null || echo '')}"

# Detect deployment mode
is_on_box=false
if [ -f /etc/lightos-release ] || [ -d ~/.config/hportal-client ] && [ -f ~/.config/hportal-client/shellapi_addr ]; then
  is_on_box=true
fi
if ls /tmp/lcmd-webshell-agent-*.sock 2>/dev/null | grep -q .; then
  # In webshell container - cannot install directly
  is_on_box=false
fi

# Get latest release info
get_latest_release() {
  curl -fsSL https://api.github.com/repos/sikenali/LPTV/releases/latest 2>/dev/null
}

# Download LPK to local file
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

# Try to install via lzc-cli (works when ON the box)
install_directly() {
  local lpk_path="$1"
  echo "Installing $lpk_path ..."
  if node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js lpk install "$lpk_path" 2>&1; then
    echo "✓ Installation successful!"
    return 0
  fi
  return 1
}

# Try to install via SSH
install_via_ssh() {
  local lpk_path="$1"
  local box="$2"
  echo "Installing via SSH to $box ..."
  # Upload and install on box
  local ssh_opts=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
  local user host port
  user=$(echo "$box" | cut -d: -f1)
  host=$(echo "$box" | cut -d: -f2 | cut -d@ -f2-)
  port=$(echo "$box" | cut -d: -f3)
  [ -z "$port" ] && port=22222

  # Upload LPK to box
  local remote_path="/tmp/cloud.lazycat.app.lptv-$(date +%s).lpk"
  echo "Uploading to $user@$host:$remote_path ..."
  scp "${ssh_opts[@]}" -P "$port" "$lpk_path" "$user@$host:$remote_path" || {
    echo "Error: Failed to upload LPK via SCP"
    return 1
  }
  # Install on box
  echo "Installing on box..."
  ssh "${ssh_opts[@]}" -p "$port" "$user@$host" \
    "lzc-cli lpk install $remote_path && rm -f $remote_path" || {
    echo "Error: Installation failed on box"
    return 1
  }
  echo "✓ Installation successful!"
  return 0
}

echo "============================================"
echo "  LPTV Deployment Script"
echo "============================================"
echo ""

# Determine box
if [ -z "$BOX" ]; then
  echo "No box specified. Attempting auto-detection..."
  # Try to get box info from webshell agent or environment
  if [ -f /proc/1/environ ]; then
    BOX=$(cat /proc/1/environ | tr '\0' '\n' | grep -E "^BOX_NAME=" | cut -d= -f2 || true)
  fi
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
echo "Mode: $([ "$is_on_box" = true ] && echo 'Direct (on box)' || echo 'Remote (container)')"
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

# Deploy based on mode
echo ""
echo "Deploying..."

if [ "$is_on_box" = true ]; then
  # Running directly on the LightOS box
  install_directly "$TMPFILE" && rm -f "$TMPFILE" && exit 0
elif [ -n "$BOX" ]; then
  # Running from container - try direct install first
  INSTALL_OUTPUT=$(node /usr/local/lib/node_modules/@lazycatcloud/lzc-cli/scripts/cli.js lpk install "$TMPFILE" 2>&1) || true
  echo "$INSTALL_OUTPUT"
  
  # Check for actual success (not just APK task creation)
  if echo "$INSTALL_OUTPUT" | grep -q "安装成功\|success\|installed"; then
    rm -f "$TMPFILE"
    echo "✓ Deployment successful!"
    exit 0
  fi

  # Network unreachable
  if echo "$INSTALL_OUTPUT" | grep -q "Network is unreachable\|Connection timed out\|remote command failed"; then
    echo ""
    echo "⚠ Box unreachable from current network (container: $(hostname -I 2>/dev/null | cut -d' ' -f1))."
    echo ""
    echo "Please install on the LightOS box directly:"
    echo ""
    echo "  Option 1: Download and install on the box"
    echo "    wget -O /tmp/$LPK_NAME '$LPK_URL'"
    echo "    lzc-cli lpk install /tmp/$LPK_NAME"
    echo ""
    echo "  Option 2: Use the pre-downloaded file"
    echo "    lzc-cli lpk install $TMPFILE"
    echo ""
    echo "  Option 3: Run this deploy script FROM the box itself"
    echo "    # SSH into the box, then:"
    echo "    bash /path/to/deploy.sh"
    rm -f "$TMPFILE"
    exit 1
  fi

  echo ""
  echo "⚠ Installation failed."
  echo ""
  echo "Manual installation steps:"
  echo "  1. Transfer the LPK to the box:"
  echo "     scp $TMPFILE <user>@<box-ip>:/tmp/"
  echo ""
  echo "  2. Install on the box:"
  echo "     lzc-cli lpk install /tmp/$LPK_NAME"
  rm -f "$TMPFILE"
  exit 1
fi
