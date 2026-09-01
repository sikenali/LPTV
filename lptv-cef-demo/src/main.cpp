#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>

#include "cef_app_capi.h"
#include "cef_browser_capi.h"
#include "cef_render_handler_capi.h"
#include "cef_string_types.h"
#include "cef_task_capi.h"
#include "cef_base_capi.h"
#include "channels.h"
#include "logger.h"

// ---- Struct definitions matching app.cpp / handler.cpp ----
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

// ---- Extern symbols from app.cpp / handler.cpp ----
extern "C" {
  extern struct _my_app_t g_my_app;
  extern void ensure_app_init();
  extern struct _my_render_handler_t g_my_render_handler;
  extern void ensure_handler_init();
}

// ---- Custom cef_client_t that returns our render handler ----
typedef struct _my_client_t {
  cef_client_t base;
} my_client_t;

// ---- Globals ----
static cef_browser_t* g_browser = nullptr;
static my_client_t* g_client = nullptr;
static int g_channel_id = 0;
static int g_source_idx = 0;
static int g_loop = 0;
static int g_interval_sec = 10;

static cef_render_handler_t* my_client_get_render_handler(cef_client_t* self) {
  (void)self;
  return reinterpret_cast<cef_render_handler_t*>(&g_my_render_handler);
}

static void my_client_init(my_client_t* client) {
  memset(client, 0, sizeof(*client));
  *reinterpret_cast<size_t*>(static_cast<void*>(&client->base)) = sizeof(cef_client_t);
  client->base.get_render_handler = my_client_get_render_handler;
}

// ---- Forward declarations ----
static int play_channel(int channel_id, int source_idx);

// ---- Timer task for loop mode ----
typedef struct _loop_task_t {
  cef_base_ref_counted_t base;
  void(CEF_CALLBACK* execute)(struct _loop_task_t* self);
  int next_channel_id;
  int interval_ms;
} loop_task_t;

static void loop_task_execute(struct _loop_task_t* task) {
  int next_id = task->next_channel_id;
  int interval = task->interval_ms;
  free(task);

  if (next_id < 1 || next_id > kChannelCount) {
    next_id = 1;
  }

  LOG_OBJ("loop_switch", ",\"channel_id\":%d,\"interval_ms\":%d", next_id, interval);
  play_channel(next_id, 0);

  // Post next delayed task
  loop_task_t* next = (loop_task_t*)calloc(1, sizeof(loop_task_t));
  if (next) {
    *reinterpret_cast<size_t*>(static_cast<void*>(&next->base)) = sizeof(cef_base_ref_counted_t);
    next->execute = loop_task_execute;
    next->next_channel_id = next_id + 1;
    if (next->next_channel_id > kChannelCount) next->next_channel_id = 1;
    next->interval_ms = interval;
    cef_post_delayed_task(TID_UI, reinterpret_cast<cef_task_t*>(next), interval);
  }
}

// ---- Helper: set cef_string from const char* ----
static void set_str(const char* src, cef_string_utf8_t* dst) {
  if (!src) { cef_string_utf8_clear(dst); return; }
  cef_string_utf8_set(src, strlen(src), dst, 1);
}

// ---- Play a channel ----
static int play_channel(int channel_id, int source_idx) {
  const Channel* ch = get_channel(channel_id);
  if (!ch) {
    LOG_ERR("invalid_channel_id");
    return -1;
  }

  if (source_idx < 0 || source_idx >= 4) {
    LOG_ERR("invalid_source_index");
    return -1;
  }

  // Find first available source starting from source_idx
  int used_source = -1;
  for (int i = source_idx; i < 4; i++) {
    if (ch->sources[i].url[0] != '\0') {
      used_source = i;
      break;
    }
  }
  // Wrap around and try from 0
  if (used_source < 0) {
    for (int i = 0; i < source_idx; i++) {
      if (ch->sources[i].url[0] != '\0') {
        used_source = i;
        break;
      }
    }
  }

  if (used_source < 0) {
    LOG_OBJ("error", ",\"reason\":\"source_not_configured\",\"channel_id\":%d", channel_id);
    return -1;
  }

  const char* url = ch->sources[used_source].url;
  LOG_OBJ("nav_started",
          ",\"channel_id\":%d,\"channel\":\"%s\",\"source_idx\":%d,\"url\":\"%s\"",
          channel_id, ch->name, g_source_idx, json_esc(url));

  // Close existing browser
  if (g_browser) {
    cef_browser_host_t* host = g_browser->get_host(g_browser);
    if (host) {
      host->close_browser(host, 1);
    }
    g_browser = nullptr;
  }

  // Cancel any pending loop tasks
  // (loop tasks are ref-counted and will be freed when the message loop exits)

  // Setup window info for OSR (Linux)
  cef_window_info_t window_info;
  memset(&window_info, 0, sizeof(window_info));
  window_info.bounds.x = 0;
  window_info.bounds.y = 0;
  window_info.bounds.width = g_my_render_handler.width;
  window_info.bounds.height = g_my_render_handler.height;
  window_info.parent_window = 0;
  window_info.windowless_rendering_enabled = 1;

  // Setup browser settings
  cef_browser_settings_t settings;
  memset(&settings, 0, sizeof(settings));
  settings.size = sizeof(settings);
  settings.windowless_frame_rate = 30;

  // Free previous client before allocating a new one
  if (g_client) { free(g_client); g_client = nullptr; }

  // Create custom client with our render handler
  g_client = (my_client_t*)calloc(1, sizeof(my_client_t));
  if (!g_client) {
    LOG_ERR("failed_to_allocate_client");
    return -1;
  }
  my_client_init(g_client);

  // Create browser (synchronous)
  cef_string_utf8_t url_str;
  set_str(url, &url_str);

  g_browser = cef_browser_host_create_browser_sync(
      &window_info,
      reinterpret_cast<cef_client_t*>(g_client),
      reinterpret_cast<const cef_string_t*>(&url_str),
      &settings,
      nullptr,
      nullptr);

  cef_string_utf8_clear(&url_str);

  if (!g_browser) {
    LOG_ERR("browser_create_failed");
    g_client = nullptr;
    return -1;
  }

  g_channel_id = channel_id;
  g_source_idx = used_source;

  LOG_OBJ("nav_committed", ",\"channel_id\":%d,\"source\":%d", channel_id, used_source);

  // Setup loop mode
  if (g_loop) {
    int next_id = channel_id + 1;
    if (next_id > kChannelCount) next_id = 1;
    int interval_ms = g_interval_sec * 1000;

    loop_task_t* task = (loop_task_t*)calloc(1, sizeof(loop_task_t));
    if (task) {
      *reinterpret_cast<size_t*>(static_cast<void*>(&task->base)) = sizeof(cef_base_ref_counted_t);
      task->execute = loop_task_execute;
      task->next_channel_id = next_id;
      task->interval_ms = interval_ms;
      cef_post_delayed_task(TID_UI, reinterpret_cast<cef_task_t*>(task), interval_ms);
    }
  }

  return 0;
}

// ---- Command parsing ----
static void print_usage(const char* prog) {
  fprintf(stderr, "Usage: %s --channel <id> [--source <0-3>] [--loop] [--interval <sec>]\n", prog);
  fprintf(stderr, "Channels: 1-%d (CCTV 1-17, 卫视 18-%d)\n", 17, kChannelCount);
  fprintf(stderr, "Sources:  0=cctv官网, 1=yangshipin, 2=789iptv(unconfigured), 3=345iptv(unconfigured)\n");
}

int main(int argc, char* argv[]) {
  int channel_id = 1;
  int source_idx = 0;
  int loop = 0;
  int interval = 10;

  // Parse args
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--channel") == 0 && i + 1 < argc) {
      channel_id = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--source") == 0 && i + 1 < argc) {
      source_idx = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--loop") == 0) {
      loop = 1;
    } else if (strcmp(argv[i], "--interval") == 0 && i + 1 < argc) {
      interval = atoi(argv[++i]);
    } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      print_usage(argv[0]);
      return 0;
    }
  }

  // Validate
  if (channel_id < 1 || channel_id > kChannelCount) {
    fprintf(stderr, "Error: channel_id must be 1-%d\n", kChannelCount);
    return 1;
  }
  if (interval < 1) {
    fprintf(stderr, "Error: interval must be >= 1\n");
    return 1;
  }

  g_channel_id = channel_id;
  g_loop = loop;
  g_interval_sec = interval;

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

  // Init app
  ensure_app_init();

  int result = cef_initialize(&main_args, &settings, reinterpret_cast<cef_app_t*>(&g_my_app), nullptr);
  if (!result) {
    fprintf(stderr, "Error: cef_initialize failed\n");
    return 1;
  }

  LOG_OBJ("cef_initialized", "");

  // Init render handler (1280x720 OSR surface)
  ensure_handler_init();

  // Play first channel
  play_channel(channel_id, source_idx);

  // Message loop (blocks until cef_quit_message_loop() is called)
  LOG_OBJ("message_loop_start", "");
  cef_run_message_loop();
  LOG_OBJ("message_loop_end", "");

  cef_shutdown();
  LOG_OBJ("shutdown_complete", "");
  if (g_client) { free(g_client); g_client = nullptr; }
  return 0;
}
