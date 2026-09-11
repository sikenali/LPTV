#include <cstdio>
#include <cstring>
#include <fstream>
#include <vector>
#include <string>
#include <algorithm>
#include <atomic>
#include <zlib.h>
#include "cef_browser_capi.h"
#include "cef_types.h"
#include "render_handler.h"
#include "logger.h"

// ── Base64 ───────────────────────────────────────────────────────────────────
static const char b64_chars[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string base64_encode(const uint8_t* data, size_t len) {
    std::string out;
    int val = 0, valb = -6;
    out.reserve(((len + 2) / 3) * 4);
    for (size_t j = 0; j < len; j++) {
        val = (val << 8) + data[j];
        valb += 8;
        while (valb >= 0) {
            out.push_back(b64_chars[(val >> valb) & 0x3f]);
            valb -= 6;
        }
    }
    if (valb > 0) {
        out.push_back(b64_chars[(val << (6 - valb)) & 0x3f]);
    }
    while (out.size() % 4) out.push_back('=');
    return out;
}

// ── PNG encoder ──────────────────────────────────────────────────────────────
static uint32_t crc32_table[256];
static bool crc_table_initialized = false;

static void init_crc_table() {
    if (crc_table_initialized) return;
    for (uint32_t n = 0; n < 256; n++) {
        uint32_t c = n;
        for (int k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320U ^ (c >> 1)) : (c >> 1);
        crc32_table[n] = c;
    }
    crc_table_initialized = true;
}

static uint32_t crc32(const uint8_t* data, size_t len) {
    init_crc_table();
    uint32_t crc = 0xFFFFFFFFU;
    for (size_t i = 0; i < len; i++)
        crc = crc32_table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    return crc ^ 0xFFFFFFFFU;
}

static void write_u32be(uint8_t* p, uint32_t v) {
    p[0] = (v >> 24) & 0xFF; p[1] = (v >> 16) & 0xFF;
    p[2] = (v >> 8) & 0xFF;  p[3] = v & 0xFF;
}

static uint32_t crc32_from_bytes(uint32_t crc, const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; i++)
        crc = crc32_table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    return crc;
}

static void png_write_chunk(std::vector<uint8_t>& out, const char* type,
                             const uint8_t* data, size_t len) {
    uint32_t crc = crc32(reinterpret_cast<const uint8_t*>(type), 4);
    crc = crc32_from_bytes(crc, data, len);
    uint32_t tot = static_cast<uint32_t>(len);
    write_u32be(out.data() + out.size(), tot); out.resize(out.size() + 4);
    out.insert(out.end(), type, type + 4);
    out.insert(out.end(), data, data + len);
    write_u32be(out.data() + out.size(), crc); out.resize(out.size() + 4);
}

// Clean PNG encoder using zlib
static std::string encode_png_to_base64(const uint8_t* rgba, int w, int h) {
    // Build PNG rows (bottom-up, BGRA)
    std::vector<uint8_t> scanlines(w * h * 4);
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            int s = (y * w + x) * 4;
            int d = ((h - 1 - y) * w + x) * 4;
            scanlines[d + 0] = rgba[s + 2];
            scanlines[d + 1] = rgba[s + 1];
            scanlines[d + 2] = rgba[s + 0];
            scanlines[d + 3] = rgba[s + 3];
        }
    }

    // Compress with zlib (Z_DEFAULT_COMPRESSION = 6)
    z_stream zs{};
    deflateInit(&zs, Z_DEFAULT_COMPRESSION);
    zs.next_in = scanlines.data();
    zs.avail_in = static_cast<uint32_t>(scanlines.size());

    // Estimate compressed size (PNG IDAT chunk has overhead)
    size_t comp_cap = std::max(scanlines.size() / 2, static_cast<size_t>(1024 * 1024));
    std::vector<uint8_t> comp(comp_cap);
    zs.next_out = comp.data();
    zs.avail_out = comp_cap;

    int ret = deflate(&zs, Z_FINISH);
    size_t comp_len = comp_cap - zs.avail_out;
    deflateEnd(&zs);

    // Build PNG bytes
    std::vector<uint8_t> png;
    // Signature
    static const uint8_t sig[8] = {137,80,78,71,13,10,26,10};
    png.insert(png.end(), sig, sig + 8);

    // IHDR
    {
        uint8_t ihdr[13] = {};
        write_u32be(ihdr, w);
        write_u32be(ihdr + 4, h);
        ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
        uint32_t crc = crc32(reinterpret_cast<const uint8_t*>("IHDR"), 4);
        crc = crc32_from_bytes(crc, ihdr, 13);
        uint32_t len = 13;
        write_u32be(png.data() + png.size(), len); png.resize(png.size() + 4);
        png.insert(png.end(), "IHDR", "IHDR"+4);
        png.insert(png.end(), ihdr, ihdr + 13);
        write_u32be(png.data() + png.size(), crc); png.resize(png.size() + 4);
    }

    // IDAT
    {
        uint32_t crc = crc32(reinterpret_cast<const uint8_t*>("IDAT"), 4);
        crc = crc32_from_bytes(crc, comp.data(), comp_len);
        uint32_t len = static_cast<uint32_t>(comp_len);
        write_u32be(png.data() + png.size(), len); png.resize(png.size() + 4);
        png.insert(png.end(), "IDAT", "IDAT"+4);
        png.insert(png.end(), comp.data(), comp.data() + comp_len);
        write_u32be(png.data() + png.size(), crc); png.resize(png.size() + 4);
    }

    // IEND
    {
        uint32_t crc = crc32(reinterpret_cast<const uint8_t*>("IEND"), 4);
        uint32_t len = 0;
        write_u32be(png.data() + png.size(), len); png.resize(png.size() + 4);
        png.insert(png.end(), "IEND", "IEND"+4);
        write_u32be(png.data() + png.size(), crc); png.resize(png.size() + 4);
    }

    return base64_encode(png.data(), png.size());
}

// ── Frame capture ────────────────────────────────────────────────────────────
struct FrameCapture {
    std::string base64_png;
    int width = 0;
    int height = 0;
    int seq = 0;
    bool ready = false;
    std::mutex mtx;
};

static FrameCapture g_frame_capture;
static std::atomic<int> g_frame_counter{0};
static constexpr int CAPTURE_INTERVAL = 6; // capture every 6th frame ≈ 5fps at 30fps CEF

// ── Render handler implementations ───────────────────────────────────────────

static void my_render_get_view_rect(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_rect_t* rect) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  rect->x = 0; rect->y = 0;
  rect->width = h->width; rect->height = h->height;
}

static int my_render_get_screen_info(
    cef_render_handler_t* self,
    cef_browser_t* browser,
    cef_screen_info_t* screen_info) {
  (void)browser;
  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  memset(screen_info, 0, sizeof(*screen_info));
  screen_info->rect.x = 0; screen_info->rect.y = 0;
  screen_info->rect.width = h->width; screen_info->rect.height = h->height;
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
  (void)type;

  my_render_handler_t* h = reinterpret_cast<my_render_handler_t*>(self);
  h->frame_count++;

  // Use the full drawable rect from dirtyRects[0] if available, else full frame
  int rx = 0, ry = 0, rw = width, rh = height;
  if (dirtyRectsCount > 0) {
    rx = dirtyRects[0].x; ry = dirtyRects[0].y;
    rw = dirtyRects[0].width; rh = dirtyRects[0].height;
  }
  // Clamp to image bounds
  if (rx < 0) { rw += rx; rx = 0; }
  if (ry < 0) { rh += ry; ry = 0; }
  if (rx + rw > width) rw = width - rx;
  if (ry + rh > height) rh = height - ry;
  if (rw <= 0 || rh <= 0) return;

  // Capture every CAPTURE_INTERVAL-th frame
  int fc = h->frame_count;
  if (fc % CAPTURE_INTERVAL != 0) return;

  const uint8_t* src = reinterpret_cast<const uint8_t*>(buffer);
  int src_stride = width * 4;
  int row_bytes = rw * 4;

  // Copy dirty rect region into a contiguous buffer (RGBA)
  std::vector<uint8_t> rect_buf(rw * rh * 4);
  for (int y = 0; y < rh; y++) {
    const uint8_t* row_src = src + (ry + y) * src_stride + rx * 4;
    std::memcpy(rect_buf.data() + y * row_bytes, row_src, row_bytes);
  }

  // Encode to base64 PNG
  std::string b64 = encode_png_to_base64(rect_buf.data(), rw, rh);

  // Store in shared frame capture
  {
    std::lock_guard<std::mutex> lock(g_frame_capture.mtx);
    g_frame_capture.base64_png = std::move(b64);
    g_frame_capture.width = rw;
    g_frame_capture.height = rh;
    g_frame_capture.seq = fc;
    g_frame_capture.ready = true;
  }

  // Also log periodically for debugging
  if (fc % (CAPTURE_INTERVAL * 30) == 0) {
    LOG_OBJ("frame_debug", ",\"seq\":%d,\"w\":%d,\"h\":%d,\"b64_len\":%zu",
            fc, rw, rh, g_frame_capture.base64_png.size());
  }
}

static void my_render_init(my_render_handler_t* h, int w, int ht) {
  memset(h, 0, sizeof(*h));
  *reinterpret_cast<size_t*>(static_cast<void*>(&h->base)) = sizeof(cef_render_handler_t);
  h->width = w; h->height = ht; h->frame_count = 0; h->first_frame_saved = 0;
  h->base.get_view_rect = my_render_get_view_rect;
  h->base.get_screen_info = my_render_get_screen_info;
  h->base.on_paint = my_render_on_paint;
}

my_render_handler_t g_my_render_handler;

void ensure_handler_init() {
  if (!*reinterpret_cast<size_t*>(static_cast<void*>(&g_my_render_handler.base))) {
    my_render_init(&g_my_render_handler, 1920, 1080);
  }
}

// Called by main.cpp to retrieve and clear the latest frame
bool try_take_frame(std::string& out_b64, int& out_w, int& out_h, int& out_seq) {
  std::lock_guard<std::mutex> lock(g_frame_capture.mtx);
  if (!g_frame_capture.ready) return false;
  out_b64 = std::move(g_frame_capture.base64_png);
  out_w = g_frame_capture.width;
  out_h = g_frame_capture.height;
  out_seq = g_frame_capture.seq;
  g_frame_capture.ready = false;
  return true;
}
