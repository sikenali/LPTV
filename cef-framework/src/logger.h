#ifndef LPTV_LOGGER_H
#define LPTV_LOGGER_H

#include <cstdio>
#include <cstring>

// JSON-escape a C string (minimal: escape " and \)
static inline const char* json_esc(const char* s) {
  static thread_local char buf[512];
  char* d = buf;
  for (; *s && d - buf < 490; ++s, ++d) {
    if (*s == '"')  { *d++ = '\\'; *d = '"'; }
    else if (*s == '\\') { *d++ = '\\'; *d = '\\'; }
    else if (*s == '\n') { *d++ = '\\'; *d = 'n'; }
    else *d = *s;
  }
  *d = '\0';
  return buf;
}

#define LOG_OBJ(evt_name, ...) do { \
  fprintf(stderr, "{\"evt\":\"%s\"", (evt_name)); \
  fprintf(stderr, ##__VA_ARGS__); \
  fprintf(stderr, "}\n"); \
  fflush(stderr); \
} while(0)

#define LOG_ERR(msg) LOG_OBJ("error", ",\"msg\":\"%s\"", json_esc(msg))

#endif // LPTV_LOGGER_H
