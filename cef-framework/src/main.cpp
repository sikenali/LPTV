#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <cstdarg>
#include <atomic>
#include <thread>
#include <string>
#include <unistd.h>
#include <chrono>
#include <fstream>
#include <sstream>

#include "cef_app_capi.h"
#include "cef_browser_capi.h"
#include "cef_client_capi.h"
#include "cef_string_types.h"
#include "cef_base_capi.h"
#include "cef_keyboard_handler_capi.h"
#include "load_handler.h"
#include "render_handler.h"
#include "keyboard_handler.h"
#include "logger.h"

static cef_load_handler_t* my_client_get_load_handler(cef_client_t* self) {
  (void)self;
  return get_load_handler();
}

static cef_render_handler_t* my_client_get_render_handler(cef_client_t* self) {
  (void)self;
  return reinterpret_cast<cef_render_handler_t*>(&g_my_render_handler);
}

static cef_keyboard_handler_t* my_client_get_keyboard_handler(cef_client_t* self) {
  (void)self;
  return reinterpret_cast<cef_keyboard_handler_t*>(&g_my_keyboard_handler);
}

extern "C" {
  extern struct _my_app_t g_my_app;
  extern void ensure_app_init();
}

static cef_browser_t* g_browser = nullptr;
static std::string g_current_url;
static std::atomic<bool> g_do_exit{false};

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

static void emit_frame(const std::string& b64, int w, int h, int seq) {
  size_t b64_len = b64.size();
  char* json = (char*)malloc(b64_len + 300);
  if (!json) return;
  int n = snprintf(json, b64_len + 300,
      "{\"evt\":\"frame_base64\",\"seq\":%d,\"w\":%d,\"h\":%d,\"data\":\"%s\"}",
      seq, w, h, b64.c_str());
  if (n > 0) {
    fwrite(json, 1, n, stdout);
    fputc('\n', stdout);
    fflush(stdout);
  }
  free(json);
}

// Navigation callback for keyboard handler
static void do_play_url(const char* url);
static void nav_to_url(const char* url) {
  do_play_url(url);
}

static void do_play_url(const char* url) {
  g_current_url = url;
  emit_evt("nav_started", ",\"url\":\"%s\"", url);
  if (g_browser) {
    cef_browser_host_t* host = g_browser->get_host(g_browser);
    if (host) host->close_browser(host, 0);
    g_browser = nullptr;
  }
  cef_window_info_t win;
  memset(&win, 0, sizeof(win));
  win.bounds.x = 0; win.bounds.y = 0;
  win.bounds.width = (int)g_my_render_handler.width;
  win.bounds.height = (int)g_my_render_handler.height;
  win.parent_window = 0;
  win.windowless_rendering_enabled = 1;
  cef_browser_settings_t bsettings;
  memset(&bsettings, 0, sizeof(bsettings));
  bsettings.size = sizeof(bsettings);
  bsettings.windowless_frame_rate = 30;
  cef_string_utf8_t url_str;
  cef_string_utf8_set(url, strlen(url), &url_str, 1);
  auto* client = reinterpret_cast<cef_client_t*>(calloc(1, sizeof(cef_client_t)));
  client->get_load_handler = my_client_get_load_handler;
  client->get_render_handler = my_client_get_render_handler;
  client->get_keyboard_handler = my_client_get_keyboard_handler;
  g_browser = cef_browser_host_create_browser_sync(
      &win, client, reinterpret_cast<cef_string_t*>(&url_str), &bsettings, nullptr, nullptr);
  cef_string_utf8_clear(&url_str);
  if (!g_browser) {
    emit_evt("error", ",\"reason\":\"browser_failed\",\"url\":\"%s\"", url);
  } else {
    emit_evt("nav_committed", ",\"url\":\"%s\"", url);
  }
}

static void do_switch_backup() {
  std::string url = g_current_url;
  size_t pos = url.find("www.345iptv.com");
  if (pos != std::string::npos) {
    url.replace(pos, strlen("www.345iptv.com"), "www.789iptv.com");
  } else {
    pos = url.find("www.789iptv.com");
    if (pos != std::string::npos) {
      url.replace(pos, strlen("www.789iptv.com"), "www.345iptv.com");
    } else {
      emit_evt("error", ",\"reason\":\"no_domain_to_switch\"");
      return;
    }
  }
  do_play_url(url.c_str());
}

// Load channels from JSON file
static void load_channels(const char* filepath) {
  std::ifstream ifs(filepath);
  if (!ifs.is_open()) {
    LOG_OBJ("channels_load_failed", ",\"path\":\"%s\"", filepath);
    return;
  }
  
  std::stringstream ss;
  ss << ifs.rdbuf();
  std::string json = ss.str();
  
  const char* p = json.c_str();
  int count = 0;
  
  const char* arr = strstr(p, "\"channels\"");
  if (!arr) return;
  arr = strchr(arr, '[');
  if (!arr) return;
  arr++;
  
  while (count < 128) {
    const char* obj = strchr(arr, '{');
    if (!obj || obj > p + json.size()) break;
    arr = obj + 1;
    
    const char* id_p = strstr(arr, "\"id\"");
    if (!id_p) break;
    id_p = strchr(id_p, ':');
    if (!id_p) break;
    id_p++;
    while (*id_p == ' ' || *id_p == '"') id_p++;
    const char* id_start = id_p;
    while (*id_p && *id_p != '"') id_p++;
    int id_len = id_p - id_start;
    
    const char* name_p = strstr(arr, "\"name\"");
    if (!name_p) name_p = arr;
    name_p = strchr(name_p, ':');
    if (!name_p) break;
    name_p++;
    while (*name_p == ' ' || *name_p == '"') name_p++;
    const char* name_start = name_p;
    while (*name_p && *name_p != '"') name_p++;
    int name_len = name_p - name_start;
    
    if (id_len > 0) {
      std::string full_url = "https://yangshipin.cn/#/tv/";
      full_url += std::string(id_start, id_len);
      
      strncpy(g_channel_urls[count], full_url.c_str(), 2047);
      strncpy(g_channel_names[count], name_start, std::min(name_len, 63));
      count++;
    }
    
    const char* next = strchr(arr, '}');
    if (!next) break;
    arr = next + 1;
  }
  
  set_channel_list(reinterpret_cast<const char**>(g_channel_urls), 
                   reinterpret_cast<const char**>(g_channel_names), 
                   count);
  set_navigation_callback(nav_to_url);
  LOG_OBJ("channels_loaded", ",\"count\":%d", count);
}

int main(int argc, char* argv[]) {
  int use_stdin = 0;
  const char* init_url = nullptr;
  const char* channels_file = nullptr;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--stdin") == 0) use_stdin = 1;
    else if (strcmp(argv[i], "--url") == 0 && i+1 < argc) init_url = argv[++i];
    else if (strcmp(argv[i], "--channels") == 0 && i+1 < argc) channels_file = argv[++i];
    else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      fprintf(stderr, "Usage: cef-tv [--url URL] [--stdin] [--channels FILE]\n");
      fprintf(stderr, "Commands:\n");
      fprintf(stderr, "  {\"cmd\":\"play_url\",\"url\":\"...\"}\n");
      fprintf(stderr, "  {\"cmd\":\"chan\",\"arg\":\"1\"}      # channel index (1-based)\n");
      fprintf(stderr, "  {\"cmd\":\"fs\",\"arg\":\"1\"}          # toggle fullscreen\n");
      fprintf(stderr, "  {\"cmd\":\"volume\",\"arg\":\"50\"}     # set volume 0-100\n");
      fprintf(stderr, "  {\"cmd\":\"panel\",\"arg\":\"1\"}       # toggle panel\n");
      fprintf(stderr, "  {\"cmd\":\"switch_backup\"}           # switch 345<->789\n");
      fprintf(stderr, "  {\"cmd\":\"stop\"}                    # stop playback\n");
      fprintf(stderr, "  {\"cmd\":\"quit\"}                    # exit\n");
      return 0;
    } else if (strncmp(argv[i], "--", 2) != 0) { init_url = argv[i]; }
  }
  
  if (channels_file) {
    load_channels(channels_file);
  }
  
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
  ensure_keyboard_handler_init();
  int result = cef_initialize(&main_args, &settings, reinterpret_cast<cef_app_t*>(&g_my_app), nullptr);
  if (!result) {
    emit_evt("error", ",\"reason\":\"cef_init_failed\"");
    return 1;
  }
  emit_evt("initialized", ",\"platform\":\"linux\",\"size\":\"%dx%d\",\"channels\":%d", 
           g_my_render_handler.width, g_my_render_handler.height, (int)g_channel_count);
  if (init_url) do_play_url(init_url);
  std::thread input_thread;
  if (use_stdin) {
    emit_evt("stdin_ready", "");
    input_thread = std::thread([]() {
      char line[8192];
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
        std::string cmd = get_str("cmd");
        std::string arg = get_str("arg");
        if (cmd == "play_url") {
          std::string url = get_str("url");
          if (!url.empty()) do_play_url(url.c_str());
        } else if (cmd == "switch_backup") {
          do_switch_backup();
        } else if (cmd == "stop") {
          if (g_browser) { cef_browser_host_t* h = g_browser->get_host(g_browser); if (h) h->close_browser(h, 0); g_browser = nullptr; }
        } else if (cmd == "quit") {
          g_do_exit.store(true);
          if (g_browser) { cef_browser_host_t* h = g_browser->get_host(g_browser); if (h) h->close_browser(h, 0); }
          break;
        } else {
          handle_ipc_command(cmd.c_str(), arg.c_str());
        }
      }
    });
  }
  emit_evt("loop_start", "");
  int frame_count = 0;
  while (!g_do_exit.load()) {
    std::string b64; int fw = 0, fh = 0, fseq = 0;
    if (try_take_frame(b64, fw, fh, fseq)) {
      emit_frame(b64, fw, fh, fseq);
    }
    cef_do_message_loop_work();
    if (!g_browser && !init_url && !use_stdin) break;
    if (!g_browser && !use_stdin) { struct timespec ts={0,50000}; nanosleep(&ts, nullptr); }
    if (g_my_render_handler.frame_count > frame_count) frame_count = g_my_render_handler.frame_count;
  }
  emit_evt("loop_end", ",\"frames\":%d", frame_count);
  if (input_thread.joinable()) input_thread.join();
  cef_shutdown();
  emit_evt("shutdown", "");
  return 0;
}
