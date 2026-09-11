#ifndef CEF_INCLUDE_CEF_FILE_DIALOG_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_FILE_DIALOG_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;

typedef struct _cef_file_dialog_handler_t {
  size_t size;
  int (*on_file_dialog)(struct _cef_file_dialog_handler_t* self, cef_browser_t* browser, int mode, const cef_string_t* title, const cef_string_t* default_path, const cef_string_t* accept_types, void* callback);
} cef_file_dialog_handler_t;

#ifdef __cplusplus
}
#endif
#endif
