#ifndef LPTV_RENDER_HANDLER_H
#define LPTV_RENDER_HANDLER_H

#include "cef_render_handler_capi.h"
#include <mutex>
#include <string>

typedef struct _my_render_handler_t {
  cef_render_handler_t base;
  int width;
  int height;
  int frame_count;
  int first_frame_saved;
} my_render_handler_t;

extern "C" {
  extern my_render_handler_t g_my_render_handler;
  void ensure_handler_init();
  // Consumes the latest captured frame; returns false if no frame ready
  bool try_take_frame(std::string& out_b64, int& out_w, int& out_h, int& out_seq);
}

#endif
