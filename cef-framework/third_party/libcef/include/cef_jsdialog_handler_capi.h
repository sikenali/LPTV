#ifndef CEF_INCLUDE_CEF_JSDIALOG_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_JSDIALOG_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;

typedef struct _cef_jsdialog_handler_t {
  size_t size;
  int (*on_jsdialog)(struct _cef_jsdialog_handler_t* self, cef_browser_t* browser, const cef_string_t* origin_url, int type, const cef_string_t* message_text, const cef_string_t* default_prompt_text, void* callback, int suppress_message);
  void (*on_before_unload_dialog)(struct _cef_jsdialog_handler_t* self, cef_browser_t* browser, const cef_string_t* message_text, int is_reload, void* callback);
  void (*on_after_jsdialog)(struct _cef_jsdialog_handler_t* self, cef_browser_t* browser, int result);
} cef_jsdialog_handler_t;

#ifdef __cplusplus
}
#endif
#endif
