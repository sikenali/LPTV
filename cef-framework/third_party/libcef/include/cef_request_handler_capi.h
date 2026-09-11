#ifndef CEF_INCLUDE_CEF_REQUEST_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_REQUEST_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;
typedef struct _cef_frame_t cef_frame_t;
typedef struct _cef_request_t cef_request_t;
typedef struct _cef_response_t cef_response_t;
typedef struct _cef_callback_t cef_callback_t;
typedef struct _cef_cookie_manager_t cef_cookie_manager_t;

typedef struct _cef_request_handler_t {
  size_t size;
  int (*get_auth_credentials)(struct _cef_request_handler_t* self, cef_browser_t* browser, int is_proxy, const cef_string_t* host, int port, const cef_string_t* realm, const cef_string_t* scheme, void* callback);
  int (*get_cookie_access_filter)(struct _cef_request_handler_t* self, cef_browser_t* browser, cef_frame_t* frame, cef_request_t* request, int is_main_frame);
  int (*get_password_authentication)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* host, int port, const cef_string_t* realm, const cef_string_t* scheme, void* callback);
  void (*onplugin_failure)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* plugin_url);
  int (*onhttp_auth)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* host, int port, int is_proxy, const cef_string_t* realm, const cef_string_t* scheme, void* callback);
  void (*oncert_error)(struct _cef_request_handler_t* self, cef_browser_t* browser, int cert_error, const cef_string_t* request_url, void* callback);
  void (*onplugincrashed)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* plugin_path);
  void (*onwebcontentunresponsive)(struct _cef_request_handler_t* self, cef_browser_t* browser, int duration);
  void (*onunresponsiveprocess)(struct _cef_request_handler_t* self, cef_browser_t* browser, int duration);
  int (*getcrossoriginopenerpolicy)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* url, int is_main_frame, int is_navigated_to_same_origin, int* policy);
  int (*getcrossoriginreferrerpolicy)(struct _cef_request_handler_t* self, cef_browser_t* browser, const cef_string_t* url, int is_main_frame, int* policy);
} cef_request_handler_t;

#ifdef __cplusplus
}
#endif
#endif
