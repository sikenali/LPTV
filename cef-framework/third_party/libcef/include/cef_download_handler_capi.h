#ifndef CEF_INCLUDE_CEF_DOWNLOAD_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_DOWNLOAD_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;
typedef struct _cef_request_t cef_request_t;

typedef struct _cef_download_handler_t {
  size_t size;
  int (*can_download)(struct _cef_download_handler_t* self, cef_browser_t* browser, const cef_string_t* url, const cef_string_t* request_method, int* suggest_name);
  void (*on_download_updated)(struct _cef_download_handler_t* self, cef_browser_t* browser, const cef_string_t* url, const cef_string_t* request_method, int suggested_name, long long current_size, long long total_size, int received_bytes, int state, int error, const cef_string_t* extension, const cef_string_t* full_path, int should_pause, int should_resume);
} cef_download_handler_t;

#ifdef __cplusplus
}
#endif
#endif
