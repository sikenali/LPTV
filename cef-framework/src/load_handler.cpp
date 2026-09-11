#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include "cef_app_capi.h"
#include "cef_load_handler_capi.h"
#include "cef_browser_capi.h"
#include "cef_frame_capi.h"
#include "cef_string_types.h"
#include "load_handler.h"
#include "logger.h"

typedef struct _my_load_handler_t {
  cef_load_handler_t base;
} my_load_handler_t;

/** Check if url is a yangshipin.cn live page */
static bool is_yangshipin_url(const char* url) {
  if (!url) return false;
  return strstr(url, "yangshipin.cn") != nullptr;
}

/** Check if url is a 345/789 iptv page */
static bool is_iptv_url(const char* url) {
  if (!url) return false;
  return strstr(url, "345iptv.com") != nullptr ||
         strstr(url, "789iptv.com") != nullptr;
}

/** Inject CSS to hide non-player elements on yangshipin.cn */
static void inject_yangshipin_css(cef_frame_t* frame) {
  // Hide all non-player elements on yangshipin.cn
  // Keep only .container (the player wrapper) visible
  const char* css =
    "/* Hide yangshipin chrome - keep only player */"
    "body > :not(.container), "
    "body > script, body > link, body > style, "
    ".y-full-bg, .video-status-tip, "
    ".volume-muted-tip-container, .volume-muted-tip, "
    ".y-full-control, .y-full-control-btn, "
    ".y-full-control-btnl, .y-full-control-btnr, "
    ".y-control-outside, .bei, .bei-list, "
    ".voice, .voice-list, .pip, .videoFull, "
    ".full, .play, .play2, "
    "header, footer, nav, [class*='header'], [class*='footer'], "
    "[class*='nav'], [class*='control'], "
    ".y-full-bg, img[src*='gif'], img[src*='icon_pay'] {"
    "  display: none !important;"
    "}"
    ".container {"
    "  position: fixed !important;"
    "  top: 0 !important;"
    "  left: 0 !important;"
    "  width: 100vw !important;"
    "  height: 100vh !important;"
    "  z-index: 1 !important;"
    "}"
    ".y-full {"
    "  width: 100vw !important;"
    "  height: 100vh !important;"
    "}"
    "html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }";

  cef_string_utf8_t css_str;
  cef_string_utf8_set(css, strlen(css), &css_str, 1);
  frame->execute_java_script(frame, reinterpret_cast<const cef_string_t*>(&css_str), nullptr, 0);
  cef_string_utf8_clear(&css_str);
  LOG_OBJ("yangshipin_css_injected", "");
}

/** Inject JS to auto-play and intercept video src on yangshipin.cn */
static void inject_yangshipin_js(cef_frame_t* frame) {
  const char* js =
    "(function(){"
    "// Auto-hide page elements that appear after load"
    "var obs = new MutationObserver(function(mutations) {"
    "  for (var m of mutations) {"
    "    for (var node of m.addedNodes) {"
    "      if (node.nodeType === 1 && node.classList) {"
    "        var cls = node.classList.toString();"
    "        if (cls.indexOf('volume-muted-tip') >= 0 || "
    "            cls.indexOf('y-full-control') >= 0 || "
    "            cls.indexOf('y-full-bg') >= 0 || "
    "            cls.indexOf('video-status-tip') >= 0) {"
    "          node.style.display = 'none';"
    "        }"
    "      }"
    "    }"
    "  }"
    "});"
    "obs.observe(document.body, { childList: true, subtree: true });"
    "// Try to auto-play"
    "setTimeout(function() {"
    "  var video = document.querySelector('video');"
    "  if (video) { video.muted = false; video.play().catch(function(){}); }"
    "  var container = document.querySelector('.container');"
    "  if (container) { container.style.position = 'fixed'; container.style.top = '0'; container.style.left = '0'; container.style.width = '100vw'; container.style.height = '100vh'; }"
    "}, 1000);"
    "})();";

  cef_string_utf8_t js_str;
  cef_string_utf8_set(js, strlen(js), &js_str, 1);
  frame->execute_java_script(frame, reinterpret_cast<const cef_string_t*>(&js_str), nullptr, 0);
  cef_string_utf8_clear(&js_str);
}

static void my_load_on_load_end(
    cef_load_handler_t* self,
    cef_browser_t* browser,
    cef_frame_t* frame,
    int httpStatusCode) {
  (void)self;
  (void)browser;
  (void)httpStatusCode;
  if (!frame || !frame->is_main(frame)) return;

  cef_string_userfree_t url = frame->get_url(frame);
  std::string url_str;
  if (url && url->str) {
    url_str.assign(reinterpret_cast<const char*>(url->str));
  }
  if (url) cef_string_userfree_free(url);

  // yangshipin.cn: inject CSS to hide non-player elements
  if (is_yangshipin_url(url_str.c_str())) {
    inject_yangshipin_css(frame);
    inject_yangshipin_js(frame);
    return;
  }

  // 345/789 iptv: inject CSS/JS to show only video player
  if (is_iptv_url(url_str.c_str())) {
    const char* css =
      "/* Hide everything except video player */"
      "* { display: none !important; }"
      "#vstPlayer, video[name='vstPlayer'], video#vstPlayer {"
      "  display: block !important;"
      "  position: fixed !important;"
      "  top: 0 !important; left: 0 !important;"
      "  width: 100vw !important;"
      "  height: 100vh !important;"
      "  object-fit: contain !important;"
      "  background: #000 !important;"
      "  z-index: 99999 !important;"
      "}"
      "html, body {"
      "  margin: 0 !important; padding: 0 !important;"
      "  overflow: hidden !important;"
      "  background: #000 !important;"
      "}";

    const char* js =
      "(function(){"
      "// Remove all non-video elements"
      "var all=document.querySelectorAll('*');"
      "for(var i=0;i<all.length;i++){"
      "  var el=all[i];"
      "  if(el.id!=='vstPlayer'&&el.tagName!=='VIDEO'"
      "    &&el.getAttribute('name')!=='vstPlayer'"
      "    &&el.tagName!=='HTML'&&el.tagName!=='BODY'"
      "    &&el.tagName!=='HEAD'&&el.tagName!=='STYLE')"
      "    el.style.display='none';"
      "}"
      "// Hide ads that may appear after load"
      "var obs=new MutationObserver(function(muts){"
      "  for(var m of muts){"
      "    for(var n of m.addedNodes){"
      "      if(n.nodeType===1)n.style.display='none';"
      "    }"
      "  }"
      "});"
      "obs.observe(document.body,{childList:true,subtree:true});"
      "})();";

    cef_string_utf8_t css_str;
    cef_string_utf8_set(css, strlen(css), &css_str, 1);
    frame->execute_java_script(frame, reinterpret_cast<const cef_string_t*>(&css_str), nullptr, 0);
    cef_string_utf8_clear(&css_str);

    cef_string_utf8_t js_str;
    cef_string_utf8_set(js, strlen(js), &js_str, 1);
    frame->execute_java_script(frame, reinterpret_cast<const cef_string_t*>(&js_str), nullptr, 0);
    cef_string_utf8_clear(&js_str);

    LOG_OBJ("inject_src_intercept", ",\"url\":\"%s\"", url_str.c_str());
  }
}

static void my_load_init(my_load_handler_t* h) {
  memset(h, 0, sizeof(*h));
  *reinterpret_cast<size_t*>(static_cast<void*>(&h->base)) = sizeof(cef_load_handler_t);
  h->base.on_load_end = my_load_on_load_end;
}

extern "C" {
  my_load_handler_t g_my_load_handler;
}

void ensure_load_handler_init() {
  if (!*reinterpret_cast<size_t*>(static_cast<void*>(&g_my_load_handler.base))) {
    my_load_init(&g_my_load_handler);
  }
}

cef_load_handler_t* get_load_handler() {
  ensure_load_handler_init();
  return reinterpret_cast<cef_load_handler_t*>(&g_my_load_handler);
}
