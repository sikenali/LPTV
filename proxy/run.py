"""
LX TV Web — 轻量启动器
用法:
  python run.py             # 启动代理 + 开浏览器
  python run.py --no-browser
  python run.py --port 9100
"""

import argparse
import os
import subprocess
import sys
import threading
import time
import webbrowser

import server

def main():
    parser = argparse.ArgumentParser(description="LX TV Web")
    parser.add_argument("--port", type=int, default=9100)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    app = server.build_app()

    print(f"\n  LX TV Web 已启动")
    print(f"  代理地址: http://localhost:{args.port}/_page")
    print(f"  直接访问: http://localhost:{args.port}/\n")

    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{args.port}/_page")).start()

    try:
        import aiohttp
        runner = aiohttp.web.AppRunner(app)
        aiohttp.web.run_app(
            app,
            host="0.0.0.0",
            port=args.port,
            print=lambda msg: print(msg.strip(), flush=True),
        )
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    # 支持直接从 proxy/ 目录运行
    sys.path.insert(0, os.path.dirname(__file__))
    main()
