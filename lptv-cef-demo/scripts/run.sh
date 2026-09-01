#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
BIN="${BUILD_DIR}/lptv-cef-demo"

if [ ! -f "$BIN" ]; then
  echo "Error: binary not found. Run cmake build first." >&2
  exit 1
fi

export LD_LIBRARY_PATH="${BUILD_DIR}:${LD_LIBRARY_PATH}"
exec "$BIN" "$@"
