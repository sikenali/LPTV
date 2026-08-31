# LPTV CEF Demo — OSR 单二进制 C++ 实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Linux x86_64 上用 CEF OSR（离屏渲染）实现电视直播频道播放器，验证多源切换与帧输出能力。

**Architecture:** 单 C++ 二进制链接 WPS 提供的 libcef.so（Chromium 104），通过 CEF C API 直接调用。OSR 模式下 OnPaint 回调输出帧元数据到 stderr，支持 34 个频道 × 2 个可用源（央视官网 + 央视频）。

**Tech Stack:** C++17, CMake 3.31, CEF 104 C API（struct-based），libpng（帧保存）

## Global Constraints

- 目标平台：Linux x86_64 裸机（后续迁移至 LPK service）
- CEF 版本：Chrome 104.0.5112（WPS libcef.so + git commit c7ea0c59 头文件）
- 构建工具：cmake 3.31.6（/home/jingle/.local/bin/cmake），g++ 14.2
- 开发库路径：/home/jingle/.local/pkg/{libpng,libjpeg,zlib}/usr/include 和 usr/lib
- 789/345 iptv token 暂未配置，仅支持 source=0（央视官网）和 source=1（央视频）
- 所有调试输出为 JSON 格式写入 stderr（每行一条）

---

## 文件结构

```
lptv-cef-demo/
├── CMakeLists.txt
├── third_party/
│   └── libcef/
│       ├── include/          # CEF 104 头文件（154 .h 文件，已从 git c7ea0c59 获取）
│       └── libcef.so        # WPS libcef.so 软链接（运行时拷贝）
├── src/
│   ├── main.cpp             # 入口：argv 解析、CEF 初始化、消息循环
│   ├── app.cpp              # CefApp 实现：命令行处理、scheme 注册
│   ├── handler.cpp          # CefRenderHandler 实现：OnPaint 帧输出
│   ├── channels.h           # 34 频道 × 2 源硬编码数据
│   └── logger.h             # JSON 日志宏
└── scripts/
    └── run.sh               # 启动脚本（设置 LD_LIBRARY_PATH + 参数转发）
```

---

### Task 1: 项目骨架与 CMakeLists.txt

**Files:**
- Create: `lptv-cef-demo/CMakeLists.txt`
- Create: `lptv-cef-demo/scripts/run.sh`

**Interfaces:**
- Produces: `lptv-cef-demo/build/lptv-cef-demo` 可执行文件
- Runtime dependency: `third_party/libcef/libcef.so`（运行时从 build 目录加载）

- [ ] **Step 1: 创建 CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.20)
project(lptv-cef-demo LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CEF 头文件路径
set(CEF_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef/include")
# CEF 库路径（WPS libcef.so）
set(CEF_LIB_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef")
# 资源路径（.pak, icudtl.dat, locales/）
set(CEF_RESOURCE_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef")

# 本地 dev 库（从 apt debs 解压）
set(USER_LOCAL_PREFIX "/home/jingle/.local")
set(PNG_INCLUDE_DIR "${USER_LOCAL_PREFIX}/pkg/libpng/usr/include")
set(JPEG_INCLUDE_DIR "${USER_LOCAL_PREFIX}/pkg/libjpeg/usr/include")
set(ZLIB_INCLUDE_DIR "${USER_LOCAL_PREFIX}/pkg/zlib/usr/include")
set(PNG_LIB_DIR "${USER_LOCAL_PREFIX}/pkg/libpng/usr/lib/x86_64-linux-gnu")
set(JPEG_LIB_DIR "${USER_LOCAL_PREFIX}/pkg/libjpeg/usr/lib/x86_64-linux-gnu")
set(ZLIB_LIB_DIR "${USER_LOCAL_PREFIX}/pkg/zlib/usr/lib/x86_64-linux-gnu")

include_directories(
  ${CEF_INCLUDE_DIR}
  ${PNG_INCLUDE_DIR}
  ${JPEG_INCLUDE_DIR}
  ${ZLIB_INCLUDE_DIR}
  src
)

link_directories(
  ${CEF_LIB_DIR}
  ${PNG_LIB_DIR}
  ${JPEG_LIB_DIR}
  ${ZLIB_LIB_DIR}
)

add_executable(lptv-cef-demo
  src/main.cpp
  src/app.cpp
  src/handler.cpp
  src/channels.h
  src/logger.h
)

target_link_libraries(lptv-cef-demo
  cef
  png
  jpeg
  z
  pthread
  dl
)

# 运行时找 libcef.so（RELATIVE 基于可执行文件位置）
set_target_properties(lptv-cef-demo PROPERTIES
  BUILD_RPATH "${CEF_LIB_DIR}"
  INSTALL_RPATH "${CEF_LIB_DIR}"
)

# 构建后拷贝资源文件到 build 目录
add_custom_command(TARGET lptv-cef-demo POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${CEF_RESOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/
  COMMENT "Copying CEF resources to build directory"
)
```

- [ ] **Step 2: 创建 run.sh**

```bash
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
```

```bash
chmod +x lptv-cef-demo/scripts/run.sh
```

- [ ] **Step 3: 准备 CEF 资源目录**

```bash
# 创建目录结构
mkdir -p lptv-cef-demo/third_party/libcef
# 拷贝 libcef.so（WPS 提供，Chromium 104.0.5112.102）
cp /opt/kingsoft/wps-office/office6/addons/cef/libcef.so lptv-cef-demo/third_party/libcef/
# 拷贝资源文件
cp /opt/kingsoft/wps-office/office6/addons/cef/*.pak lptv-cef-demo/third_party/libcef/
cp /opt/kingsoft/wps-office/office6/addons/cef/icudtl.dat lptv-cef-demo/third_party/libcef/
cp -r /opt/kingsoft/wps-office/office6/addons/cef/locales lptv-cef-demo/third_party/libcef/
cp /opt/kingsoft/wps-office/office6/addons/cef/swiftshader/*.so lptv-cef-demo/third_party/libcef/swiftshader/ 2>/dev/null || true
```

- [ ] **Step 4: 验证头文件完整性**

```bash
find lptv-cef-demo/third_party/libcef/include -name "*.h" | wc -l
# 预期: >= 150
test -f lptv-cef-demo/third_party/libcef/include/capi/cef_app_capi.h
test -f lptv-cef-demo/third_party/libcef/include/capi/cef_render_handler_capi.h
test -f lptv-cef-demo/third_party/libcef/include/capi/cef_browser_capi.h
test -f lptv-cef-demo/third_party/libcef/include/internal/cef_types.h
echo "Headers OK"
```

- [ ] **Step 5: 初次编译验证**

```bash
cd lptv-cef-demo
mkdir -p build && cd build
/home/jingle/.local/bin/cmake .. -DCMAKE_BUILD_TYPE=Release 2>&1 | tail -5
/home/jingle/.local/bin/cmake --build . -j$(nproc) 2>&1 | tail -10
ls -lh lptv-cef-demo
echo "Build OK"
```

- [ ] **Step 6: Commit**

```bash
cd /home/jingle/opc/LPTV
git add lptv-cef-demo/CMakeLists.txt lptv-cef-demo/scripts/ lptv-cef-demo/third_party/
git commit -m "feat: add lptv-cef-demo project skeleton with CMake and CEF resources"
```

---

### Task 2: Logger 与频道数据

**Files:**
- Create: `src/logger.h`
- Create: `src/channels.h`

**Interfaces:**
- Consumes: 无
- Produces: `LOG_JSON(evt, ...)` 宏，`kChannels[]` 数组（34 个频道）

- [ ] **Step 1: 创建 logger.h**

```cpp
#ifndef LPTV_LOGGER_H
#define LPTV_LOGGER_H

#include <cstdio>
#include <cstring>

// JSON-escape a C string (minimal: escape " and \)
static inline const char* json_esc(const char* s) {
  static thread_local char buf[512];
  char* d = buf;
  for (; *s && d - buf < 490; ++s, ++d) {
    if (*s == '"')  { *d++ = '\\'; *d = '"'; }
    else if (*s == '\\') { *d++ = '\\'; *d = '\\'; }
    else if (*s == '\n') { *d++ = '\\'; *d = 'n'; }
    else *d = *s;
  }
  *d = '\0';
  return buf;
}

#define LOG_JSON(...) fprintf(stderr, "%s\n", json_fmt(__VA_ARGS__))

#define LOG_OBJ(evt_name, ...) do { \
  fprintf(stderr, "{\"evt\":\"%s\"", (evt_name)); \
  fprintf(stderr, ##__VA_ARGS__); \
  fprintf(stderr, "}\n"); \
  fflush(stderr); \
} while(0)

#define LOG_ERR(msg) LOG_OBJ("error", ",\"msg\":\"%s\"", json_esc(msg))

#endif // LPTV_LOGGER_H
```

- [ ] **Step 2: 创建 channels.h**

```cpp
#ifndef LPTV_CHANNELS_H
#define LPTV_CHANNELS_H

#include <cstdint>
#include <cstring>

struct Source {
  int  priority;
  const char* domain;
  const char* url;
};

struct Channel {
  int     id;
  const char* name;
  const char* category;
  Source    sources[4];
};

constexpr Channel kChannels[] = {
  // CCTV 1-17 (id 1-17)
  { 1, "CCTV1 综合",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv1/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001859"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 2, "CCTV2 财经",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv2/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001800"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 3, "CCTV3 综艺",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv3/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001801"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 4, "CCTV4 中文国际","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv4/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001814"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 5, "CCTV5 体育",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv5/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001818"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 6, "CCTV5+ 体育赛事","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv5plus/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001817"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 7, "CCTV6 电影",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv6/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600108442"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 8, "CCTV7 国防军事","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv7/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600004092"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 9, "CCTV8 电视剧", "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv8/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001803"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {10, "CCTV9 纪录",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctvjilu/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600004078"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {11, "CCTV10 科教",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv10/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001805"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {12, "CCTV11 戏曲",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv11/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001806"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {13, "CCTV12 社会与法","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv12/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001807"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {14, "CCTV13 新闻",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv13/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001811"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {15, "CCTV14 少儿",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctvchild/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001809"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {16, "CCTV15 音乐",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv15/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001815"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {17, "CCTV16 奥林匹克","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv16/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600098637"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {18, "CCTV17 农业农村","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv17/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001810"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  // 卫视 1-32 (id 18-49)
  {18, "湖南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002475"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {19, "江苏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002521"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {20, "东方卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002483"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {21, "浙江卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002520"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {22, "北京卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002309"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {23, "深圳卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002481"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {24, "广东卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002485"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {25, "安徽卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002532"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {26, "东南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002484"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {27, "河北卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002493"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {28, "黑龙江卫视","卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002498"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {29, "湖北卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002508"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {30, "江西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002503"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {31, "辽宁卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002505"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {32, "海南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002506"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {33, "山东卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002513"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {34, "四川卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002516"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {35, "天津卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600152137"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {36, "重庆卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002531"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {37, "贵州卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002490"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {38, "吉林卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190405"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {39, "广西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002509"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {40, "河南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002525"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {41, "甘肃卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190408"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {42, "青海卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190406"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {43, "云南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190402"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {44, "内蒙古卫视","卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190401"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {45, "山西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190407"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {46, "陕西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190400"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {47, "新疆卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600152138"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {48, "西藏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190403"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {49, "宁夏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190737"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
};

constexpr int kChannelCount = sizeof(kChannels) / sizeof(kChannels[0]);

static inline const Channel* get_channel(int id) {
  if (id < 1 || id > kChannelCount) return nullptr;
  return &kChannels[id - 1];
}

#endif // LPTV_CHANNELS_H
```

- [ ] **Step 2: Commit**

```bash
git add lptv-cef-demo/src/logger.h lptv-cef-demo/src/channels.h
git commit -m "feat: add logger macros and 34-channel hardcoded data"
```

---

### Task 3: App 与 Render Handler 实现

**Files:**
- Create: `src/app.cpp`
- Create: `src/handler.cpp`

**Interfaces:**
- Consumes: `channels.h`, `logger.h`
- Produces: `MyApp` 全局对象，`MyRenderHandler` 全局对象
- CEF 回调: `on_before_command_line_processing`, `on_register_custom_schemes`
- CEF 回调: `get_view_rect`, `get_screen_info`, `on_paint`

- [ ] **Step 1: 创建 app.cpp**

```cpp
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include "include/capi/cef_app_capi.h"
#include "include/capi/cef_command_line_capi.h"
#include "include/capi/cef_scheme_capi.h"
#include "include/capi/cef_string_types.h"
#include "logger.h"

// ---- MyApp struct ----
typedef struct _my_app_t {
  cef_app_t base;
  // application state
  int initialized;
} my_app_t;

// ---- C callback implementations ----

static void my_app_on_before_command_line_processing(
    cef_app_t* self,
    const cef_string_t* process_type,
    cef_command_line_t* command_line) {
  (void)self;
  (void)process_type;
  if (!command_line || !command_line->is_valid(command_line)) return;

  // Disable sandbox
  cef_string_t switch_name;
  cef_string_utf8_set("no-sandbox", 10, &switch_name, 1);
  command_line->append_switch(command_line, &switch_name);
  cef_string_clear(&switch_name);

  // Set mobile UA to bypass yangshipin redirect
  cef_string_t ua_name, ua_val;
  cef_string_utf8_set("user-agent", 10, &ua_name, 1);
  cef_string_utf8_set(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      110, &ua_val, 1);
  command_line->append_switch_with_value(command_line, &ua_name, &ua_val);
  cef_string_clear(&ua_name);
  cef_string_clear(&ua_val);

  LOG_OBJ("cmd_line_processed");
}

static void my_app_on_register_custom_schemes(
    cef_app_t* self,
    cef_scheme_registrar_t* registrar) {
  (void)self;
  if (!registrar) return;

  cef_string_t scheme_name;
  cef_string_utf8_set("lptv", 4, &scheme_name, 1);
  // options: 0 = default (scheme is standard, cross-origin accessible)
  registrar->add_custom_scheme(registrar, &scheme_name, 0);
  cef_string_clear(&scheme_name);

  LOG_OBJ("scheme_registered", ",\"name\":\"lptv\"");
}

static cef_browser_process_handler_t* my_app_get_browser_process_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

static cef_resource_bundle_handler_t* my_app_get_resource_bundle_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

static cef_render_process_handler_t* my_app_get_render_process_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

// ---- vtable setup ----
static void my_app_init(my_app_t* app) {
  memset(app, 0, sizeof(*app));
  app->base.size = sizeof(cef_app_t);
  app->base.on_before_command_line_processing = my_app_on_before_command_line_processing;
  app->base.on_register_custom_schemes = my_app_on_register_custom_schemes;
  app->base.get_browser_process_handler = my_app_get_browser_process_handler;
  app->base.get_resource_bundle_handler = my_app_get_resource_bundle_handler;
  app->base.get_render_process_handler = my_app_get_render_process_handler;
  app->initialized = 1;
}
```

- [ ] **Step 2: 创建 handler.cpp**

```cpp
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include "include/capi/cef_browser_capi.h"
#include "include/capi/cef_render_handler_capi.h"
#include "include/capi/cef_string_types.h"
#include "include/internal/cef_types.h"
#include "logger.h"

// ---- MyRenderHandler ----
typedef struct _my_render_handler_t {
  cef_render_handler_t base;
  int width;
  int height;
  int frame_count;
  int first_frame_saved;
} my_render_handler_t;

static void my_render_get_view_rect(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_rect_t* rect) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  rect->x = 0;
  rect->y = 0;
  rect->width = h->width;
  rect->height = h->height;
}

static int my_render_get_screen_info(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_screen_info_t* screen_info) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  memset(screen_info, 0, sizeof(*screen_info));
  screen_info->size = sizeof(cef_screen_info_t);
  screen_info->rect.x = 0;
  screen_info->rect.y = 0;
  screen_info->rect.width = h->width;
  screen_info->rect.height = h->height;
  screen_info->device_scale_factor = 1.0f;
  return 1;
}

static void my_render_on_paint(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_paint_element_type_t type,
    size_t dirtyRectsCount,
    const cef_rect_t* dirtyRects,
    const void* buffer,
    int width,
    int height) {
  (void)browser;
  (void)dirtyRects;
  (void)type;

  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  h->frame_count++;

  // Log frame metadata every 30 frames to avoid spam
  if (h->frame_count % 30 == 1) {
    LOG_OBJ("frame_paint",
            ",\"w\":%d,\"h\":%d,\"seq\":%d,\"size\":%zu",
            width, height, h->frame_count,
            static_cast<size_t>(width) * height * 4);
  }

  // Save first frame as PNG for manual verification
  if (!h->first_frame_saved && buffer && width > 0 && height > 0) {
    h->first_frame_saved = 1;
    // Write raw RGBA to file for inspection (later convert with Python)
    std::ofstream f("/tmp/lptv-first-frame.raw", std::ios::binary);
    if (f) {
      f.write(static_cast<const char*>(buffer), width * height * 4);
      f.close();
      LOG_OBJ("frame_saved", ",\"path\":\"/tmp/lptv-first-frame.raw\",\"w\":%d,\"h\":%d", width, height);
    }
  }
}

static void my_render_init(my_render_handler_t* h, int w, int h) {
  memset(h, 0, sizeof(*h));
  h->base.size = sizeof(cef_render_handler_t);
  h->width = w;
  h->height = h;
  h->frame_count = 0;
  h->first_frame_saved = 0;
  h->base.get_view_rect = my_render_get_view_rect;
  h->base.get_screen_info = my_render_get_screen_info;
  h->base.on_paint = my_render_on_paint;
}
```

- [ ] **Step 3: Commit**

```bash
git add lptv-cef-demo/src/app.cpp lptv-cef-demo/src/handler.cpp
git commit -m "feat: add CEF app and render handler implementations"
```

---

### Task 4: Main 入口与频道导航逻辑

**Files:**
- Create: `src/main.cpp`

**Interfaces:**
- Consumes: `channels.h`, `app.cpp`, `handler.cpp`, `logger.h`
- CLI: `--channel <id>` (1-49), `--source <0-1>` (default 0), `--loop`, `--interval <sec>`
- 状态机: IDLE → LOADING → PLAYING → (ERROR → switch_line)

- [ ] **Step 1: 创建 main.cpp**

```cpp
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <unistd.h>
#include "include/capi/cef_app_capi.h"
#include "include/capi/cef_browser_capi.h"
#include "include/capi/cef_render_handler_capi.h"
#include "include/capi/cef_string_types.h"
#include "include/internal/cef_types.h"
#include "channels.h"
#include "logger.h"

// Forward declarations from app.cpp / handler.cpp
extern void my_app_init(struct _my_app_t* app);
extern void my_render_init(struct _my_render_handler_t* h, int w, int h);
extern struct _my_app_t g_app;
extern struct _my_render_handler_t g_handler;

static struct _my_app_t g_app;
static struct _my_render_handler_t g_handler;
static cef_browser_t* g_browser = nullptr;

// ---- Helper: set cef_string from const char* ----
static void set_str(const char* src, cef_string_t* dst) {
  if (!src) { cef_string_clear(dst); return; }
  cef_string_utf8_set(src, strlen(src), dst, 1);
}

// ---- Play a channel ----
static int play_channel(int channel_id, int source_idx) {
  const Channel* ch = get_channel(channel_id);
  if (!ch) {
    LOG_ERR("invalid_channel_id");
    return -1;
  }

  if (source_idx < 0 || source_idx >= 4) {
    LOG_ERR("invalid_source_index");
    return -1;
  }

  // Find first available source
  int used_source = -1;
  for (int i = source_idx; i < 4; i++) {
    if (ch->sources[i].url[0] != '\0') {
      used_source = i;
      break;
    }
  }

  if (used_source < 0) {
    LOG_OBJ("error", ",\"reason\":\"source_not_configured\",\"channel_id\":%d", channel_id);
    return -1;
  }

  const char* url = ch->sources[used_source].url;
  LOG_OBJ("nav_started",
          ",\"channel_id\":%d,\"channel\":\"%s\",\"source_idx\":%d,\"url\":\"%s\"",
          channel_id, ch->name, used_source, json_esc(url));

  // Close existing browser
  if (g_browser) {
    // Browser will be closed via life span handler; just null out our ref
    g_browser = nullptr;
  }

  // Setup window info for OSR (Linux)
  cef_window_info_t window_info;
  memset(&window_info, 0, sizeof(window_info));
  window_info.bounds.x = 0;
  window_info.bounds.y = 0;
  window_info.bounds.width = g_handler.width;
  window_info.bounds.height = g_handler.height;
  window_info.parent_window = 0;
  window_info.windowless_rendering_enabled = 1;  // OSR mode

  // Setup browser settings
  cef_browser_settings_t settings;
  memset(&settings, 0, sizeof(settings));
  settings.size = sizeof(settings);
  settings.windowless_frame_rate = 30;  // max 30 fps for OSR

  // Create browser (synchronous - blocks until browser is ready)
  cef_string_t url_str;
  set_str(url, &url_str);

  g_browser = cef_browser_host_create_browser_sync(
      &window_info,
      nullptr,  // client (use default)
      &url_str,
      &settings,
      nullptr,  // extra_info
      nullptr); // request_context

  cef_string_clear(&url_str);

  if (!g_browser) {
    LOG_ERR("browser_create_failed");
    return -1;
  }

  LOG_OBJ("nav_committed", ",\"channel_id\":%d,\"source\":%d", channel_id, used_source);
  return 0;
}

// ---- Command parsing ----
static void print_usage(const char* prog) {
  fprintf(stderr, "Usage: %s --channel <id> [--source <0-3>] [--loop] [--interval <sec>]\n", prog);
  fprintf(stderr, "Channels: 1-17 (CCTV), 18-49 (卫视)\n");
  fprintf(stderr, "Sources:  0=cctv官网, 1=yangshipin, 2=789iptv(unconfigured), 3=345iptv(unconfigured)\n");
}

int main(int argc, char* argv[]) {
  int channel_id = 1;
  int source_idx = 0;
  int loop = 0;
  int interval = 10;

  // Parse args
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--channel") == 0 && i + 1 < argc) {
      channel_id = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--source") == 0 && i + 1 < argc) {
      source_idx = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--loop") == 0) {
      loop = 1;
    } else if (strcmp(argv[i], "--interval") == 0 && i + 1 < argc) {
      interval = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      print_usage(argv[0]);
      return 0;
    }
  }

  // Validate
  if (channel_id < 1 || channel_id > kChannelCount) {
    fprintf(stderr, "Error: channel_id must be 1-%d\n", kChannelCount);
    return 1;
  }

  // Init CEF
  cef_main_args_t main_args;
  memset(&main_args, 0, sizeof(main_args));
  cef_settings_t settings;
  memset(&settings, 0, sizeof(settings));
  settings.size = sizeof(settings);
  settings.no_sandbox = 1;
  settings.windowless_rendering_enabled = 1;
  settings.multi_threaded_message_loop = 0;  // single-threaded message loop

  my_app_init(&g_app);

  int result = cef_initialize(&main_args, &settings, reinterpret_cast<cef_app_t*>(&g_app), nullptr);
  if (!result) {
    fprintf(stderr, "Error: cef_initialize failed\n");
    return 1;
  }

  LOG_OBJ("cef_initialized");

  // Init render handler (1280x720 OSR surface)
  my_render_init(&g_handler, 1280, 720);

  // Play first channel
  play_channel(channel_id, source_idx);

  // Message loop (blocks until cef_quit_message_loop() is called)
  LOG_OBJ("message_loop_start");
  cef_run_message_loop();
  LOG_OBJ("message_loop_end");

  cef_shutdown();
  LOG_OBJ("shutdown_complete");
  return 0;
}
```

- [ ] **Step 2: 编译测试**

```bash
cd lptv-cef-demo/build
/home/jingle/.local/bin/cmake .. -DCMAKE_BUILD_TYPE=Release 2>&1 | tail -5
/home/jingle/.local/bin/cmake --build . -j$(nproc) 2>&1
```

- [ ] **Step 3: 运行测试**

```bash
# 在 lptv-cef-demo/build 目录下
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 1 2>&1 | head -20
# 预期: 看到 cef_initialized, nav_started, frame_paint 等日志
# Ctrl+C 退出
```

- [ ] **Step 4: Commit**

```bash
git add lptv-cef-demo/src/main.cpp
git commit -m "feat: add main entry point with channel navigation and OSR browser creation"
```

---

### Task 5: 修复与完善（按需）

**Files:**
- Modify: `src/main.cpp`
- Modify: `src/app.cpp`
- Modify: `src/handler.cpp`

根据编译错误和运行测试结果修复：

1. **编译期修复**：
   - 检查 `cef_window_info_t` 字段名是否匹配 CEF 104 头文件
   - 修正 `cef_string_utf8_set` 调用签名（4参数: src, len, output, copy）
   - 处理 Linux 上 `CEF_CALLBACK` 为空宏（无需 `__stdcall`）

2. **运行期修复**：
   - 验证 `OnPaint` 回调是否被触发
   - 检查 `/tmp/lptv-first-frame.raw` 是否生成
   - 用 Python 验证帧数据：`python3 -c "import struct; data=open('/tmp/lptv-first-frame.raw','rb').read(); print(f'{len(data)} bytes, {len(data)//4} pixels')"`)

3. **频道切换**：
   - 实现 `--loop` 模式下的自动频道切换
   - 每 N 秒切换到下一个频道

- [ ] **Step 1: 根据编译/运行错误修复代码**

```bash
# 运行测试并观察错误
cd lptv-cef-demo/build
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 1 2>&1
# 记录所有错误信息
```

- [ ] **Step 2: 修复后重新编译**

```bash
cd lptv-cef-demo/build
/home/jingle/.local/bin/cmake --build . -j$(nproc) 2>&1
```

- [ ] **Step 3: 验证验收标准**

```bash
# 测试1: CCTV1 播放
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 1 2>&1 | grep -E '"evt"' | head -10

# 测试2: 央视频道
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 1 --source 1 2>&1 | grep -E '"evt"' | head -10

# 测试3: 未配置的源（应报错退出）
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 1 --source 2 2>&1 | grep -E '"evt"|error'

# 测试4: 卫视（source=1 应为央视频）
LD_LIBRARY_PATH=. ./lptv-cef-demo --channel 18 2>&1 | grep -E '"evt"' | head -10

# 测试5: 帧文件验证
ls -lh /tmp/lptv-first-frame.raw 2>/dev/null && python3 -c "
data = open('/tmp/lptv-first-frame.raw','rb').read()
print(f'Frame: {len(data)} bytes, {len(data)//4} pixels')
"
```

- [ ] **Step 4: Commit 修复**

```bash
git add lptv-cef-demo/src/
git commit -m "fix: resolve compilation and runtime issues"
```

---

## 验收标准

- [ ] `cmake --build` 成功，生成 `lptv-cef-demo` 二进制
- [ ] `./lptv-cef-demo --channel 1` 启动后输出 `cef_initialized` 日志
- [ ] stderr 输出 `nav_started` 和 `nav_committed` 事件
- [ ] `OnPaint` 触发，stderr 持续输出 `frame_paint`（每 30 帧一条）
- [ ] `/tmp/lptv-first-frame.raw` 生成且大小 > 0（1280×720×4 = 3686400 字节）
- [ ] `--channel 1 --source 1` 切换到央视频道正常渲染
- [ ] `--channel 1 --source 2` 打印 `source_not_configured` 错误后安全退出
- [ ] 全部 34 个频道（1-49）均可正常导航（source=0 或 source=1）
- [ ] Ctrl+C 正常退出，无崩溃

## 已知限制

1. 789/345 iptv token 未配置，`--source 2/3` 将报错退出
2. 无 Unix Socket IPC（验证阶段用 stderr 日志代替）
3. 无 WebSocket 帧推送（验证阶段仅打印元数据 + 保存首帧 raw）
4. CEF 版本为 Chromium 104（非 spec 中的 120），API 兼容但功能可能略有差异

## 后续步骤

1. 验证通过后，将 libcef.so 替换为 Chrome 120 版本（需网络访问 cef-builds.spotify.com）
2. 添加 Node.js IPC 层（Unix Socket + WebSocket）
3. 添加 DOM 广告清理逻辑
4. 迁移至 LPK service
