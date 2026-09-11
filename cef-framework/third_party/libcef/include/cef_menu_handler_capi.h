#ifndef CEF_INCLUDE_CEF_MENU_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_MENU_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;

typedef struct _cef_menu_handler_t {
  size_t size;
  int (*on_before_menu)(struct _cef_menu_handler_t* self, cef_browser_t* browser, const int* x, const int* y);
  void (*on_menu_close)(struct _cef_menu_handler_t* self, cef_browser_t* browser);
} cef_menu_handler_t;

#ifdef __cplusplus
}
#endif
#endif
