#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <cstdarg>
#include <atomic>
#include <thread>
#include <string>
#include <unistd.h>
#include <fstream>

#include "cef_app_capi.h"
#include "cef_browser_capi.h"
#include "cef_render_handler_capi.h"
#include "cef_string_types.h"
#include "cef_base_capi.h"
#include "cef_client_capi.h"
#include "channels.h"
#include "logger.h"

// ---- Structs (matching app.cpp / handler.cpp) ----
struct _my_app_t {
  cef_app_t base;
  int initialized;
};

struct _my_render_handler_t {
  cef_render_handler_t base;
  int width;
  int height;
  int frame_count;
  int first_frame_saved;
};

struct _my_client_t {
  cef_client_t base;
};

extern "C" {
  extern struct _my_app_t g_my_app;
  extern void ensure_app_init();
  extern struct _my_render_handler_t g_my_render_handler;
  extern void ensure_handler_init();
}

// ---- Globals ----
static cef_browser_t* g_browser = nullptr;
static std::atomic<int> g_pending_channel{0};
static std::atomic<int> g_pending_source{0};
static std::atomic<bool> g_do_exit{false};

// ---- Emit JSON event to stdout ----
static void emit_evt(const char* name, const char* fmt, ...) {
  fprintf(stdout, "{\"evt\":\"%s\"", name);
  if (fmt) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stdout, fmt, ap);
    va_end(ap);
  }
  fprintf(stdout, "}\n");
  fflush(stdout);
}

// ---- Custom client: returns our render handler ----
static cef_render_handler_t* my_client_get_render_handler(cef_client_t* self) {
  (void)self;
  return reinterpret_cast<cef_render_handler_t*>(&g_my_render_handler);
}

// ---- Play channel ----
static void do_play(int channel_id, int source_idx) {
  const Channel* ch = get_channel(channel_id);
  if (!ch) {
    emit_evt("error", ",\"reason\":\"invalid_channel\",\"id\":%d", channel_id);
    return;
  }

  // Find available source
  int used = -1;
  for (int i = source_idx; i < 4; i++) {
    if (ch->sources[i].url[0] != '\0') { used = i; break; }
  }
  if (used < 0) {
    for (int i = 0; i < source_idx; i++) {
      if (ch->sources[i].url[0] != '\0') { used = i; break; }
    }
  }
  if (used < 0) {
    emit_evt("error", ",\"reason\":\"no_source\",\"channel_id\":%d", channel_id);
    return;
  }

  const char* url = ch->sources[used].url;
  emit_evt("nav_started", ",\"channel_id\":%d,\"channel\":\"%s\",\"source\":%d,\"url\":\"%s\"",
           channel_id, ch->name, used, url);

  // Close existing browser
  if (g_browser) {
    cef_browser_host_t* host = g_browser->get_host(g_browser);
    if (host) host->close_browser(host, 0);
    g_browser = nullptr;
  }

  // Setup window info for OSR (Linux)
  cef_window_info_t win;
  memset(&win, 0, sizeof(win));
  win.bounds.x = 0; win.bounds.y = 0;
  win.bounds.width = (int)g_my_render_handler.width;
  win.bounds.height = (int)g_my_render_handler.height;
  win.parent_window = 0;
  win.windowless_rendering_enabled = 1;

  // Browser settings
  cef_browser_settings_t bsettings;
  memset(&bsettings, 0, sizeof(bsettings));
  bsettings.size = sizeof(bsettings);
  bsettings.windowless_frame_rate = 30;

  // URL string (use utf8 type directly)
  cef_string_utf8_t url_str;
  cef_string_utf8_set(url, strlen(url), &url_str, 1);

  g_browser = cef_browser_host_create_browser_sync(
      &win,
      reinterpret_cast<cef_client_t*>(calloc(1, sizeof(cef_client_t))),
      reinterpret_cast<cef_string_t*>(&url_str),
      &bsettings,
      nullptr, nullptr);

  // Free the string
  cef_string_utf8_clear(&url_str);

  if (!g_browser) {
    emit_evt("error", ",\"reason\":\"browser_failed\",\"channel_id\":%d", channel_id);
  } else {
    emit_evt("nav_committed", ",\"channel_id\":%d,\"source\":%d", channel_id, used);
  }
}

// ---- Main ----
int main(int argc, char* argv[]) {
  int channel_id = 1;
  int source_idx = 0;
  int use_stdin = 0;

  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--channel") == 0 && i+1 < argc) channel_id = atoi(argv[++i]);
    else if (strcmp(argv[i], "--source") == 0 && i+1 < argc) source_idx = atoi(argv[++i]);
    else if (strcmp(argv[i], "--stdin") == 0) use_stdin = 1;
    else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      fprintf(stderr, "Usage: lptv-cef-demo [--channel N] [--source N] [--stdin]\n");
      fprintf(stderr, "  --stdin  Read JSON commands from stdin, output events to stdout\n");
      fprintf(stderr, "  Commands: {\"cmd\":\"play\",\"channel_id\":N,[\"source\":N]}\n");
      fprintf(stderr, "            {\"cmd\":\"switch\"}  {\"cmd\":\"stop\"}  {\"cmd\":\"quit\"}\n");
      return 0;
    }
  }

  if (channel_id < 1 || channel_id > kChannelCount) {
    emit_evt("error", ",\"reason\":\"invalid_channel\",\"id\":%d", channel_id);
    return 1;
  }

  // Init CEF
  cef_main_args_t main_args;
  memset(&main_args, 0, sizeof(main_args));
  main_args.argc = argc;
  main_args.argv = argv;

  cef_settings_t settings;
  memset(&settings, 0, sizeof(settings));
  settings.size = sizeof(settings);
  settings.no_sandbox = 1;
  settings.windowless_rendering_enabled = 1;
  settings.multi_threaded_message_loop = 0;

  ensure_app_init();
  ensure_handler_init();

  int result = cef_initialize(&main_args, &settings, reinterpret_cast<cef_app_t*>(&g_my_app), nullptr);
  if (!result) {
    emit_evt("error", ",\"reason\":\"cef_init_failed\"");
    return 1;
  }

  emit_evt("initialized", ",\"platform\":\"linux\"");

  // Start first channel
  do_play(channel_id, source_idx);
  g_pending_channel.store(0);
  g_pending_source.store(source_idx);

  // If stdin mode, spawn input thread
  std::thread input_thread;
  if (use_stdin) {
    emit_evt("stdin_ready", "");

    input_thread = std::thread([]() {
      char line[4096];
      while (fgets(line, sizeof(line), stdin)) {
        std::string s(line);
        auto get_str = [&](const char* key) -> std::string {
          std::string sk = std::string("\"") + key + "\"";
          size_t p = s.find(sk);
          if (p == std::string::npos) return "";
          p += sk.length();
          while (p < s.length() && (s[p]==' '||s[p]==':'||s[p]=='\t')) p++;
          size_t start = p;
          if (s[p] == '"') { p++; start = p; while (p < s.length() && s[p] != '"') p++; return s.substr(start, p-start); }
          while (p < s.length() && s[p] != ',' && s[p] != '}' && s[p] != ' ') p++;
          return s.substr(start, p-start);
        };
        auto get_int = [&](const char* key, int def) -> int {
          std::string v = get_str(key);
          return v.empty() ? def : atoi(v.c_str());
        };

        std::string cmd = get_str("cmd");
        if (cmd == "play") {
          int cid = get_int("channel_id", 0);
          int src = get_int("source", 0);
          if (cid >= 1 && cid <= kChannelCount) {
            g_pending_channel.store(cid);
            g_pending_source.store(src);
          }
        } else if (cmd == "switch") {
          // Close current browser to trigger source switch on next loop iteration
          if (g_browser) {
            cef_browser_host_t* host = g_browser->get_host(g_browser);
            if (host) host->close_browser(host, 0);
            g_browser = nullptr;
          }
          emit_evt("switch_requested", "");
        } else if (cmd == "stop") {
          if (g_browser) {
            cef_browser_host_t* host = g_browser->get_host(g_browser);
            if (host) host->close_browser(host, 0);
            g_browser = nullptr;
          }
        } else if (cmd == "quit") {
          g_do_exit.store(true);
          if (g_browser) {
            cef_browser_host_t* host = g_browser->get_host(g_browser);
            if (host) host->close_browser(host, 0);
          }
          break;
        }
      }
    });
  }

  // Message loop
  emit_evt("loop_start", "");
  int frame_count = 0;

  while (!g_do_exit.load()) {
    // Check for pending channel switch
    int pending = g_pending_channel.load();
    if (pending != 0 && !g_browser) {
      g_pending_channel.store(0);
      int src = g_pending_source.load();
      do_play(pending, src);
    }

    cef_do_message_loop_work();

    // If browser closed and no pending, check if we should exit
    if (!g_browser && pending == 0 && !use_stdin) break;
    if (!g_browser && pending == 0) {
      struct timespec ts = {0, 50000};
      nanosleep(&ts, nullptr);
    }

    if (g_my_render_handler.frame_count > frame_count) {
      frame_count = g_my_render_handler.frame_count;
    }
  }

  emit_evt("loop_end", ",\"frames\":%d", frame_count);

  if (input_thread.joinable()) input_thread.join();
  cef_shutdown();
  emit_evt("shutdown", "");
  return 0;
}
