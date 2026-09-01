# LPTV CEF Demo

CEF OSR TV player demo for Linux x86_64.

## Build

```bash
cd lptv-cef-demo
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
```

## Runtime Setup

Copy CEF runtime files from WPS or a CEF build:

```bash
# From WPS (if available):
cp /opt/kingsoft/wps-office/office6/addons/cef/libcef.so third_party/libcef/
cp /opt/kingsoft/wps-office/office6/addons/cef/*.pak third_party/libcef/
cp /opt/kingsoft/wps-office/office6/addons/cef/icudtl.dat third_party/libcef/
cp -r /opt/kingsoft/wps-office/office6/addons/cef/locales third_party/libcef/
```

## Run

```bash
./scripts/run.sh --channel 1        # Play CCTV1
./scripts/run.sh --channel 18       # Play 湖南卫视
./scripts/run.sh --channel 1 --loop --interval 5  # Cycle channels
```

## Sources

| ID | Source | URL |
|----|--------|-----|
| 0 | 央视官网 | tv.cctv.com/live/xxx |
| 1 | 央视频 | yangshipin.cn/tv/home?pid=xxx |
| 2 | 789iptv | (unconfigured) |
| 3 | 345iptv | (unconfigured) |
