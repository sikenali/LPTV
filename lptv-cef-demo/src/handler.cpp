#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include "cef_browser_capi.h"
#include "cef_render_handler_capi.h"
#include "cef_string_types.h"
#include "cef_types.h"
#include "logger.h"

// ---- MyRenderHandler ----
typedef struct _my_render_handler_t {
  cef_render_handler_t base;
  int width;
  int height;
  int frame_count;
  int first_frame_saved;
} my_render_handler_t;

static void my_render_get_view_rect(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_rect_t* rect) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  rect->x = 0;
  rect->y = 0;
  rect->width = h->width;
  rect->height = h->height;
}

static int my_render_get_screen_info(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_screen_info_t* screen_info) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  memset(screen_info, 0, sizeof(*screen_info));
  screen_info->rect.x = 0;
  screen_info->rect.y = 0;
  screen_info->rect.width = h->width;
  screen_info->rect.height = h->height;
  screen_info->device_scale_factor = 1.0f;
  return 1;
}

static void my_render_on_paint(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_paint_element_type_t type,
    size_t dirtyRectsCount,
    const cef_rect_t* dirtyRects,
    const void* buffer,
    int width,
    int height) {
  (void)browser;
  (void)dirtyRects;
  (void)type;

  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  if (++h->frame_count % 30 == 0) {
    LOG_OBJ("frame_paint",
            ",\"w\":%d,\"h\":%d,\"seq\":%d,\"size\":%zu",
            width, height, h->frame_count,
            static_cast<size_t>(width) * height * 4);
  }

  if (!h->first_frame_saved && buffer && width > 0 && height > 0) {
    h->first_frame_saved = 1;
    std::ofstream f("/tmp/lptv-first-frame.raw", std::ios::binary);
    if (f) {
      f.write(static_cast<const char*>(buffer), width * height * 4);
      f.close();
      LOG_OBJ("frame_saved", ",\"path\":\"/tmp/lptv-first-frame.raw\",\"w\":%d,\"h\":%d", width, height);
    }
  }
}

static void my_render_init(my_render_handler_t* h, int w, int ht) {
  memset(h, 0, sizeof(*h));
  *reinterpret_cast<size_t*>(static_cast<void*>(&h->base)) = sizeof(cef_render_handler_t);
  h->width = w;
  h->height = ht;
  h->frame_count = 0;
  h->first_frame_saved = 0;
  h->base.get_view_rect = my_render_get_view_rect;
  h->base.get_screen_info = my_render_get_screen_info;
  h->base.on_paint = my_render_on_paint;
}

extern "C" {
  my_render_handler_t g_my_render_handler;
  void ensure_handler_init();
}

void ensure_handler_init() {
  if (!*reinterpret_cast<size_t*>(static_cast<void*>(&g_my_render_handler.base))) {
    my_render_init(&g_my_render_handler, 1280, 720);
  }
}
