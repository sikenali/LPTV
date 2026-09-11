#ifndef LPTV_RESOURCE_HANDLER_H
#define LPTV_RESOURCE_HANDLER_H

#include "cef_resource_handler_capi.h"
#include <string>

typedef struct _my_resource_handler_t {
  cef_resource_handler_t base;
  std::string file_path;
} my_resource_handler_t;

extern "C" {
  bool resolve_assets_local(const char* url, char* out_path, size_t path_len);
}

#endif
