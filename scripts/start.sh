#!/bin/sh
set -e

mkdir -p /app/data /app/archives /app/logs
chmod -R 777 /app/data || true

# 启动后端，日志写入文件
PORT=$BACKEND_PORT DATA_DIR=/app/data ARCHIVE_DIR=/app/archives \
  /lzcapp/pkg/content/backend/lzmail >>/app/logs/backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端就绪（最多60秒）
for i in $(seq 1 30); do
  sleep 2
  if wget -qO- http://127.0.0.1:$BACKEND_PORT/api/v1/health >/dev/null 2>&1; then
    echo "backend healthy after ${i}x2s"
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "backend exited with code $?, logs:"
    cat /app/logs/backend.log
    exit 1
  fi
done

# 启动前端
# 前端由 lzcinit 静态服务，无需额外启动
# 任一进程退出则结束容器
while kill -0 $BACKEND_PID 2>/dev/null; do
  sleep 2
done

echo "container stopped: backend=$BACKEND_PID"
echo "=== backend log ==="
cat /app/logs/backend.log
exit 0
