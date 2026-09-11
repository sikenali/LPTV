cmake_minimum_required(VERSION 3.20)
project(cef-tv LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CEF_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef/include")
set(CEF_LIB_DIR "${CMAKE_SOURCE_DIR}/third_party/libcef")

find_library(CEF_LIB cef PATHS
  ${CEF_LIB_DIR}
  /opt/kingsoft/wps-office/office6/addons/cef
  NO_DEFAULT_PATH
)

set(USER_LOCAL_PREFIX "/home/jingle/.local")

include_directories(
  ${CEF_INCLUDE_DIR}
  ${CEF_LIB_DIR}
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

add_executable(cef-tv
  src/main.cpp
  src/app.cpp
  src/handler.cpp
  src/load_handler.cpp
  src/keyboard_handler.cpp
  src/logger.h
  src/render_handler.h
  src/keyboard_handler.h
)

target_link_libraries(cef-tv ${CEF_LIB} png jpeg z pthread dl)

set_target_properties(cef-tv PROPERTIES
  BUILD_RPATH "\$ORIGIN"
  INSTALL_RPATH "\$ORIGIN"
  BUILD_RPATH_USE_ORIGIN ON
)
