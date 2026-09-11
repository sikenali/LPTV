#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <unordered_map>
#include <mutex>
#include <filesystem>
#include "cef_request_capi.h"
#include "cef_response_capi.h"
#include "cef_resource_handler_capi.h"
#include "resource_handler.h"
#include "logger.h"

namespace fs = std::filesystem;

static std::string get_resources_dir() {
  char exe[4096];
  ssize_t n = readlink("/proc/self/exe", exe, sizeof(exe)-1);
  if (n > 0) {
    exe[n] = 0;
    std::string d = std::string(exe);
    size_t p = d.rfind('/');
    if (p != std::string::npos) d = d.substr(0, p);
    for (auto& c : {std::string(d+"/resources"), d+"/../resources", d+"/cef-framework/resources"}) {
      if (fs::exists(c + "/js/dy-hls.min.js")) return c;
    }
  }
  return "resources";
}

static std::string g_res_dir;

bool resolve_assets_local(const char* url, char* out_path, size_t path_len) {
  if (g_res_dir.empty()) g_res_dir = get_resources_dir();
  const char* prefix = "assets-local://";
  if (strncmp(url, prefix, strlen(prefix)) != 0) return false;
  std::string rel;
  for (size_t i = strlen(prefix); url[i]; ++i) {
    if (url[i] == '%' && url[i+1] && url[i+2]) {
      char h[3] = {url[i+1], url[i+2], 0};
      rel += (char)strtol(h, nullptr, 16);
      i += 2;
    } else if (url[i] == '+') rel += ' ';
    else rel += url[i];
  }
  std::string full = g_res_dir + "/" + rel;
  if (path_len > 0) snprintf(out_path, path_len, "%s", full.c_str());
  return fs::exists(full);
}

struct StreamEntry {
  std::ifstream stream;
  char buf[65536];
};
static std::mutex g_stream_mutex;
static std::unordered_map<const void*, StreamEntry> g_streams;

static const char* mime_for_path(const char* path) {
  std::string p = path;
  if (p.find(".js") != std::string::npos) return "application/javascript";
  if (p.find(".html") != std::string::npos) return "text/html";
  if (p.find(".json") != std::string::npos) return "application/json";
  return "application/octet-stream";
}

static void utf8_to_utf16(const char* src, cef_string_utf16_t* dst) {
  size_t len = strlen(src);
  dst->str = (char16*)malloc((len + 1) * sizeof(char16));
  dst->length = len;
  for (size_t i = 0; i < len; i++) dst->str[i] = (char16)src[i];
  dst->str[len] = 0;
}

static int my_res_open(cef_resource_handler_t* self, cef_request_t* request, int* handles, cef_callback_t* callback) {
  (void)request; (void)callback;
  auto* h = reinterpret_cast<my_resource_handler_t*>(self);
  if (!h->file_path.empty() && fs::exists(h->file_path)) {
    *handles = 1;
    LOG_OBJ("resource_open", ",\"path\":\"%s\"", h->file_path.c_str());
    return 1;
  }
  *handles = 0;
  return 0;
}

static void my_res_get_headers(cef_resource_handler_t* self, cef_response_t* response, long long* len, cef_string_t* redirect) {
  (void)redirect;
  auto* h = reinterpret_cast<my_resource_handler_t*>(self);
  if (len) *len = 0;
  const char* mime = mime_for_path(h->file_path.c_str());
  cef_string_utf16_t ms;
  utf8_to_utf16(mime, &ms);
  if (response->set_mime_type) response->set_mime_type(response, (const cef_string_t*)&ms);
  free(ms.str);
  response->set_status(response, 200);
}

static int my_res_read(cef_resource_handler_t* self, void* out, int sz, int* rd, cef_callback_t* cb) {
  (void)cb;
  auto* h = reinterpret_cast<my_resource_handler_t*>(self);
  std::lock_guard<std::mutex> lock(g_stream_mutex);
  auto it = g_streams.find(self);
  StreamEntry* e = nullptr;
  if (it == g_streams.end()) {
    e = &g_streams[self];
    e->stream.open(h->file_path, std::ios::binary);
    if (!e->stream.is_open()) { if (rd) *rd = 0; return 0; }
  } else {
    e = &it->second;
    if (e->stream.eof() || e->stream.fail()) { if (rd) *rd = 0; return 0; }
  }
  e->stream.read(e->buf, sizeof(e->buf));
  int n = (int)e->stream.gcount();
  if (n > sz) n = sz;
  if (out && n > 0) memcpy(out, e->buf, n);
  if (rd) *rd = n;
  return n > 0 ? 1 : 0;
}

static void my_res_init(my_resource_handler_t* h, const char* path) {
  memset(h, 0, sizeof(*h));
  *reinterpret_cast<size_t*>(static_cast<void*>(&h->base)) = sizeof(cef_resource_handler_t);
  h->file_path = path ? path : "";
  h->base.open = my_res_open;
  h->base.get_response_headers = my_res_get_headers;
  h->base.read_response = my_res_read;
}
