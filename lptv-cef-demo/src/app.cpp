#include <cstdio>
#include <cstdlib>
#include <cstring>
#include "cef_app_capi.h"
#include "cef_command_line_capi.h"
#include "cef_scheme_capi.h"
#include "cef_string_types.h"
#include "logger.h"

// ---- MyApp struct ----
typedef struct _my_app_t {
  cef_app_t base;
  int initialized;
} my_app_t;

// ---- C callback implementations ----

static void my_app_on_before_command_line_processing(
    cef_app_t* self,
    const cef_string_t* process_type,
    cef_command_line_t* command_line) {
  (void)self;
  (void)process_type;
  if (!command_line || !command_line->is_valid(command_line)) return;

  cef_string_utf8_t switch_name;
  cef_string_utf8_set("no-sandbox", 10, &switch_name, 1);
  command_line->append_switch(command_line, reinterpret_cast<const cef_string_t*>(&switch_name));
  cef_string_utf8_clear(&switch_name);

  cef_string_utf8_t ua_name, ua_val;
  cef_string_utf8_set("user-agent", 10, &ua_name, 1);
  cef_string_utf8_set(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      110, &ua_val, 1);
  command_line->append_switch_with_value(command_line, reinterpret_cast<const cef_string_t*>(&ua_name), reinterpret_cast<const cef_string_t*>(&ua_val));
  cef_string_utf8_clear(&ua_name);
  cef_string_utf8_clear(&ua_val);

  LOG_OBJ("cmd_line_processed", "");
}

static void my_app_on_register_custom_schemes(
    cef_app_t* self,
    cef_scheme_registrar_t* registrar) {
  (void)self;
  if (!registrar) return;

  cef_string_utf8_t scheme_name;
  cef_string_utf8_set("lptv", 4, &scheme_name, 1);
  registrar->add_custom_scheme(registrar, reinterpret_cast<const cef_string_t*>(&scheme_name), 0);
  cef_string_utf8_clear(&scheme_name);

  LOG_OBJ("scheme_registered", ",\"name\":\"lptv\"");
}

static cef_browser_process_handler_t* my_app_get_browser_process_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

static cef_resource_bundle_handler_t* my_app_get_resource_bundle_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

static cef_render_process_handler_t* my_app_get_render_process_handler(
    cef_app_t* self) {
  (void)self;
  return nullptr;
}

static void my_app_init(my_app_t* app) {
  memset(app, 0, sizeof(*app));
  *reinterpret_cast<size_t*>(static_cast<void*>(&app->base)) = sizeof(cef_app_t);
  app->base.on_before_command_line_processing = my_app_on_before_command_line_processing;
  app->base.on_register_custom_schemes = my_app_on_register_custom_schemes;
  app->base.get_browser_process_handler = my_app_get_browser_process_handler;
  app->base.get_resource_bundle_handler = my_app_get_resource_bundle_handler;
  app->base.get_render_process_handler = my_app_get_render_process_handler;
  app->initialized = 1;
}

extern "C" {
  my_app_t g_my_app;
  void ensure_app_init();
}

void ensure_app_init() {
  if (!g_my_app.initialized) {
    my_app_init(&g_my_app);
  }
}
