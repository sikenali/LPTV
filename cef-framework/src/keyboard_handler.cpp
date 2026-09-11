#include <cstdio>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <atomic>
#include <chrono>
#include <algorithm>
#include "cef_keyboard_handler_capi.h"
#include "keyboard_handler.h"
#include "logger.h"
static void emit_evt(const char* name, const char* fmt, ...) { fprintf(stdout, "{\"evt\":\"%s\"", name); if (fmt) { va_list ap; va_start(ap, fmt); vfprintf(stdout, fmt, ap); va_end(ap); } fprintf(stdout, "}\n"); fflush(stdout); }

// Channel navigation state - extern so main.cpp can access
std::atomic<int> g_current_channel_index{-1};
std::atomic<int> g_channel_count{0};
std::atomic<bool> g_panel_visible{false};
std::atomic<int> g_volume{50};
std::atomic<bool> g_fullscreen{false};
std::atomic<int> g_digit_buffer{0};
std::atomic<bool> g_digit_active{false};
std::chrono::steady_clock::time_point g_digit_start;

// Channel URL list
char g_channel_urls[128][2048];
char g_channel_names[128][64];
int g_max_channels = 128;

// Callback for navigation (set by main.cpp)
static void (*g_nav_callback)(const char* url) = nullptr;

void set_navigation_callback(void (*cb)(const char*)) {
  g_nav_callback = cb;
}

void set_channel_list(const char** urls, const char** names, int count) {
  g_channel_count = count;
  for (int i = 0; i < count && i < g_max_channels; i++) {
    strncpy(g_channel_urls[i], urls[i] ? urls[i] : "", 2047);
    strncpy(g_channel_names[i], names[i] ? names[i] : "", 63);
  }
  LOG_OBJ("channels_loaded", ",\"count\":%d", count);
}

static int my_handle_key_event(
    cef_keyboard_handler_t* self,
    cef_browser_t* browser,
    const cef_key_event_t* event,
    cef_event_handle_t /*os_event*/) {
  (void)self;
  (void)browser;
  
  if (event->type != KEYEVENT_RAWKEYDOWN) return 0;

  int key = event->windows_key_code;

  // Channel number input (0-9)
  if (key >= '0' && key <= '9') {
    int digit = key - '0';
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - g_digit_start).count();

    if (elapsed > 1500 || !g_digit_active.load()) {
      g_digit_buffer = digit;
      g_digit_active = true;
    } else {
      g_digit_buffer = g_digit_buffer.load() * 10 + digit;
    }
    g_digit_start = now;

    int buf = g_digit_buffer.load();
    if (buf >= 100 || elapsed > 800) {
      int idx = buf - 1;
      if (idx >= 0 && idx < g_channel_count.load() && g_nav_callback) {
        g_current_channel_index = idx;
        g_nav_callback(g_channel_urls[idx]);
        emit_evt("channel_changed", ",\"index\":%d,\"name\":\"%s\"", idx, g_channel_names[idx]);
      }
      g_digit_active = false;
    }
    return 1;
  }

  switch (key) {
    case 0x26: {  // VK_UP - Previous channel
      int idx = g_current_channel_index.load();
      if (idx <= 0) idx = g_channel_count - 1;
      else idx--;
      g_current_channel_index = idx;
      if (g_nav_callback) g_nav_callback(g_channel_urls[idx]);
      emit_evt("channel_changed", ",\"index\":%d,\"name\":\"%s\"", idx, g_channel_names[idx]);
      break;
    }
    case 0x28: {  // VK_DOWN - Next channel
      int idx = g_current_channel_index.load();
      if (idx < 0) idx = 0;
      if (idx >= g_channel_count - 1) idx = 0;
      else idx++;
      g_current_channel_index = idx;
      if (g_nav_callback) g_nav_callback(g_channel_urls[idx]);
      emit_evt("channel_changed", ",\"index\":%d,\"name\":\"%s\"", idx, g_channel_names[idx]);
      break;
    }
    case 0x25: {  // VK_LEFT - Volume down
      int vol = g_volume.load();
      vol = std::max(0, vol - 5);
      g_volume = vol;
      emit_evt("volume_changed", ",\"volume\":%d", vol);
      break;
    }
    case 0x27: {  // VK_RIGHT - Volume up
      int vol = g_volume.load();
      vol = std::min(100, vol + 5);
      g_volume = vol;
      emit_evt("volume_changed", ",\"volume\":%d", vol);
      break;
    }
    case 0x0D: {  // VK_RETURN - Toggle fullscreen
      g_fullscreen = !g_fullscreen.load();
      emit_evt("fullscreen_toggled", ",\"state\":%d", g_fullscreen.load());
      break;
    }
    case 0x1B: {  // VK_ESCAPE
      if (g_panel_visible.load()) {
        g_panel_visible = false;
        emit_evt("panel_hidden", "");
      } else {
        g_fullscreen = false;
        emit_evt("fullscreen_toggled", ",\"state\":0");
      }
      break;
    }
    case 0x73: {  // F4 key
      g_panel_visible = !g_panel_visible.load();
      emit_evt("panel_toggled", ",\"visible\":%d", g_panel_visible.load());
      break;
    }
    default:
      break;
  }
  return 1;
}

void ensure_keyboard_handler_init() {
  if (!*reinterpret_cast<size_t*>(static_cast<void*>(&g_my_keyboard_handler.base))) {
    memset(&g_my_keyboard_handler, 0, sizeof(g_my_keyboard_handler));
    *reinterpret_cast<size_t*>(static_cast<void*>(&g_my_keyboard_handler.base)) = sizeof(cef_keyboard_handler_t);
    g_my_keyboard_handler.base.on_key_event = my_handle_key_event;
  }
}

void handle_ipc_command(const char* cmd, const char* arg) {
  if (strcmp(cmd, "chan") == 0) {
    int idx = atoi(arg) - 1;
    if (idx >= 0 && idx < g_channel_count.load() && g_nav_callback) {
      g_current_channel_index = idx;
      g_nav_callback(g_channel_urls[idx]);
      emit_evt("channel_changed", ",\"index\":%d,\"name\":\"%s\"", idx, g_channel_names[idx]);
    }
  } else if (strcmp(cmd, "fs") == 0) {
    g_fullscreen = atoi(arg) ? true : false;
    emit_evt("fullscreen_toggled", ",\"state\":%d", g_fullscreen.load());
  } else if (strcmp(cmd, "volume") == 0) {
    int vol = atoi(arg);
    vol = std::max(0, std::min(100, vol));
    g_volume = vol;
    emit_evt("volume_changed", ",\"volume\":%d", vol);
  } else if (strcmp(cmd, "panel") == 0) {
    g_panel_visible = atoi(arg) ? true : false;
    emit_evt("panel_toggled", ",\"visible\":%d", g_panel_visible.load());
  } else if (strcmp(cmd, "channel_info") == 0) {
    int idx = g_current_channel_index.load();
    if (idx >= 0) {
      emit_evt("channel_info", ",\"index\":%d,\"name\":\"%s\",\"total\":%d",
               idx, g_channel_names[idx], g_channel_count.load());
    }
  } else if (strcmp(cmd, "state") == 0) {
    emit_evt("state", ",\"channel\":%d,\"volume\":%d,\"fs\":%d,\"panel\":%d",
             g_current_channel_index.load(), g_volume.load(),
             g_fullscreen.load(), g_panel_visible.load());
  }
}
my_keyboard_handler_t g_my_keyboard_handler;
