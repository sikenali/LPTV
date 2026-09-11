#ifndef CEF_INCLUDE_CEF_FOCUS_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_FOCUS_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;

typedef struct _cef_focus_handler_t {
  size_t size;
  void (*on_take_focus)(struct _cef_focus_handler_t* self, cef_browser_t* browser, int next);
  int (*on_set_focus)(struct _cef_focus_handler_t* self, cef_browser_t* browser, int source);
  void (*on_lost_focus)(struct _cef_focus_handler_t* self, cef_browser_t* browser);
} cef_focus_handler_t;

#ifdef __cplusplus
}
#endif
#endif
