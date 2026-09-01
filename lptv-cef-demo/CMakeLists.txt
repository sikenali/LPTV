cmake_minimum_required(VERSION 3.20)
project(lptv-cef-demo LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CEF 头文件路径
set(CEF_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef/include")
# CEF 库路径
set(CEF_LIB_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef")
# 资源路径
set(CEF_RESOURCE_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef")

# 尝试从多个位置找 libcef.so
find_library(CEF_LIB cef PATHS
  ${CEF_LIB_DIR}
  /opt/kingsoft/wps-office/office6/addons/cef
  /usr/local/lib
  NO_DEFAULT_PATH
)
if(NOT CEF_LIB)
  message(WARNING "libcef.so not found. Copy from WPS: /opt/kingsoft/wps-office/office6/addons/cef/libcef.so")
  set(CEF_LIB "cef")  # Will fail at link time but allows configure
endif()

# 本地 dev 库
set(USER_LOCAL_PREFIX "/home/jingle/.local")

include_directories(
  ${CEF_INCLUDE_DIR}
  ${CEF_INCLUDE_DIR}/..
  ${CEF_INCLUDE_DIR}/capi
  ${CEF_INCLUDE_DIR}/base
  ${CEF_INCLUDE_DIR}/internal
  ${USER_LOCAL_PREFIX}/pkg/libpng/usr/include
  ${USER_LOCAL_PREFIX}/pkg/libjpeg/usr/include
  ${USER_LOCAL_PREFIX}/pkg/zlib/usr/include
  src
)

link_directories(
  ${CEF_LIB_DIR}
  ${USER_LOCAL_PREFIX}/pkg/libpng/usr/lib/x86_64-linux-gnu
  ${USER_LOCAL_PREFIX}/pkg/libjpeg/usr/lib/x86_64-linux-gnu
  ${USER_LOCAL_PREFIX}/pkg/zlib/usr/lib/x86_64-linux-gnu
)

add_executable(lptv-cef-demo
  src/main.cpp
  src/app.cpp
  src/handler.cpp
  src/channels.h
  src/logger.h
)

target_link_libraries(lptv-cef-demo
  ${CEF_LIB}
  png
  jpeg
  z
  pthread
  dl
)

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
