#!/bin/sh
set -e

mkdir -p /app/data /app/logs
chmod -R 777 /app/data || true

BUNDLED_DEPS="/lzcapp/pkg/content/node_modules"
FALLBACK_NM="/tmp/lptv-node-modules"

if [ -d "$BUNDLED_DEPS" ]; then
  export NODE_PATH="$BUNDLED_DEPS"
else
  echo "[start] no bundled node_modules, installing..."
  if [ ! -d "$FALLBACK_NM" ]; then
    npm install --prefix "$FALLBACK_NM" express cors --production --loglevel=error 2>&1 || { echo "[start] FAILED to install deps"; exit 1; }
  fi
  export NODE_PATH="$FALLBACK_NM/node_modules"
fi

LPTV_CEF_BIN=/lzcapp/pkg/content/scripts/cef-bin \
  LD_LIBRARY_PATH=/lzcapp/pkg/content/scripts:$LD_LIBRARY_PATH \
  node /lzcapp/pkg/content/scripts/proxy-server.cjs >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 30); do
  sleep 2
  if wget -qO- http://127.0.0.1:$BACKEND_PORT/health >/dev/null 2>&1; then
    echo "backend healthy after ${i}x2s"
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "backend exited with code $?, logs:"
    cat /app/logs/backend.log
    exit 1
  fi
done

while kill -0 $BACKEND_PID 2>/dev/null; do
  sleep 2
done

echo "container stopped: backend=$BACKEND_PID"
echo "=== backend log ==="
cat /app/logs/backend.log
exit 0
