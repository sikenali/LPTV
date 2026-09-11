#ifndef CEF_INCLUDE_CEF_AUDIO_HANDLER_CAPI_H_
#define CEF_INCLUDE_CEF_AUDIO_HANDLER_CAPI_H_
#pragma once
#include "cef_base_capi.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_browser_t cef_browser_t;

typedef struct _cef_audio_handler_t {
  size_t size;
  int (*on_audio_stream_started)(struct _cef_audio_handler_t* self, cef_browser_t* browser, const int* parameters, int frames_per_buffer, void* callback);
  void (*on_audio_stream_stopped)(struct _cef_audio_handler_t* self, cef_browser_t* browser, void* callback);
  void (*on_audio_stream_error)(struct _cef_audio_handler_t* self, cef_browser_t* browser, void* callback);
} cef_audio_handler_t;

#ifdef __cplusplus
}
#endif
#endif
