#ifndef CEF_INCLUDE_CEF_DISPLAY_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_DISPLAY_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;
typedef struct _cef_frame_t cef_frame_t;

typedef struct _cef_display_handler_t {
  size_t size;
  void (*on_status_message)(struct _cef_display_handler_t* self, cef_browser_t* browser, const cef_string_t* value, int type);
  void (*on_console_message)(struct _cef_display_handler_t* self, cef_browser_t* browser, const cef_string_t* message, const cef_string_t* source, int line);
  void (*on_title_change)(struct _cef_display_handler_t* self, cef_browser_t* browser, const cef_string_t* title);
  int (*on_progress_change)(struct _cef_display_handler_t* self, cef_browser_t* browser, double progress);
  void (*on_document_available)(struct _cef_display_handler_t* self, cef_browser_t* browser);
  void (*on_loading_state_change)(struct _cef_display_handler_t* self, cef_browser_t* browser, int loading, int can_go_back, int can_go_forward);
  void (*on_draw)(struct _cef_display_handler_t* self, cef_browser_t* browser, const void* buffer, int type, const int* dirtyRects, int width, int height);
  void (*on_focus)(struct _cef_display_handler_t* self, cef_browser_t* browser);
  int (*on_set_focus)(struct _cef_display_handler_t* self, cef_browser_t* browser, int source);
  void (*on_context_menu)(struct _cef_display_handler_t* self, cef_browser_t* browser, int x, int y);
  void (*on_move)(struct _cef_display_handler_t* self, cef_browser_t* browser, int x, int y);
  void (*on_resize)(struct _cef_display_handler_t* self, cef_browser_t* browser, int width, int height);
  int (*get_selected_text)(struct _cef_display_handler_t* self, cef_browser_t* browser, cef_string_t* text);
  void (*on_closing)(struct _cef_display_handler_t* self, cef_browser_t* browser);
  int (*handle_command_key_event)(struct _cef_display_handler_t* self, cef_browser_t* browser, int event_type, int key_code, int modifiers);
} cef_display_handler_t;

#ifdef __cplusplus
}
#endif
#endif
