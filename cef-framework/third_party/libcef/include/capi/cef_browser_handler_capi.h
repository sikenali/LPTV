#ifndef CEF_INCLUDE_CAPI_CEF_BROWSER_HANDLER_CAPI_H_
#define CEF_INCLUDE_CAPI_CEF_BROWSER_HANDLER_CAPI_H_
#pragma once
#include "../cef_base.h"
#include "cef_string_types.h"
#ifdef __cplusplus
extern "C" {
#endif
typedef struct _cef_browser_t cef_browser_t;
typedef struct _cef_frame_t cef_frame_t;
typedef struct _cef_window_info_t cef_window_info_t;
typedef struct _cef_browser_settings_t cef_browser_settings_t;
typedef struct _cef_popup_features_t cef_popup_features_t;
typedef struct _cef_ref_counted_t cef_ref_counted_t;
typedef enum { WOD_DEFAULT=0,WOD_NEW_FOREGROUND_TAB=1,WOD_NEW_BACKGROUND_TAB=2,WOD_NEW_POPUP=3,WOD_NEW_WINDOW=4,WOD_SAVE_TO_DISK=5,WOD_ADD_TO_HISTORY=6,WOD_NEW_UNKWNOWN=7 } cef_window_open_disposition_t;
typedef struct _cef_browser_handler_t {
  size_t size;
  int (*on_before_popup)(struct _cef_browser_handler_t* self, cef_browser_t* browser, cef_frame_t* frame, const cef_string_t* target_url, const cef_string_t* target_name, cef_window_open_disposition_t disposition, int user_gesture, const cef_popup_features_t* features, cef_window_info_t* windowInfo, cef_browser_settings_t* settings, cef_ref_counted_t* extra_info, int* hide);
  void (*on_after_create)(struct _cef_browser_handler_t* self, cef_browser_t* browser);
  void (*on_destroy)(struct _cef_browser_handler_t* self, cef_browser_t* browser);
  void (*ON_FULLSCREEN_MODE_CHANGE)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int fullscreen);
  void (*on_title_change)(struct _cef_browser_handler_t* self, cef_browser_t* browser, const cef_string_t* title);
  void (*on_favicon_urlchange)(struct _cef_browser_handler_t* self, cef_browser_t* browser, const cef_string_t* icon_urls, int icon_url_count);
  int (*get_favicon)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int size, void* bitmap, int* width, int* height);
  int (*is_matching_app_command)(struct _cef_browser_handler_t* self, cef_browser_t* browser, const cef_string_t* command);
  void (*on_app_command)(struct _cef_browser_handler_t* self, cef_browser_t* browser, const cef_string_t* command, int is_key_up);
  int (*on_mouse_button_change)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int modifiers, int button, int is_key_up);
  void (*on_touch_event)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int type, int modifiers, float x, float y);
  void (*on_virtual_key_event)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int type, int windows_key_code, int native_key_code, int modifiers, int flags);
  void (*on_accelerated_viewer_disabled)(struct _cef_browser_handler_t* self, cef_browser_t* browser);
  int (*on_process_message_received)(struct _cef_browser_handler_t* self, cef_browser_t* browser, int process_id, void* message);
} cef_browser_handler_t;
#ifdef __cplusplus
}
#endif
#endif
