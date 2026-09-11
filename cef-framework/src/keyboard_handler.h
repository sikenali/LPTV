#ifndef LPTV_KEYBOARD_HANDLER_H
#define LPTV_KEYBOARD_HANDLER_H

#include "cef_keyboard_handler_capi.h"
#include <atomic>
#include <chrono>

extern std::atomic<int> g_current_channel_index;
extern std::atomic<int> g_channel_count;
extern std::atomic<bool> g_panel_visible;
extern std::atomic<int> g_volume;
extern std::atomic<bool> g_fullscreen;
extern char g_channel_urls[128][2048];
extern char g_channel_names[128][64];

typedef struct _my_keyboard_handler_t {
  cef_keyboard_handler_t base;
} my_keyboard_handler_t;

extern "C" {
  extern my_keyboard_handler_t g_my_keyboard_handler;
  void ensure_keyboard_handler_init();
  void set_channel_list(const char** urls, const char** names, int count);
  void set_navigation_callback(void (*cb)(const char*));
  void handle_ipc_command(const char* cmd, const char* arg);
}

#endif
