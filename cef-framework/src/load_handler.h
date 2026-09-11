#ifndef LPTV_LOAD_HANDLER_H
#define LPTV_LOAD_HANDLER_H

#include "cef_load_handler_capi.h"

extern "C" {
  void ensure_load_handler_init();
  cef_load_handler_t* get_load_handler();
}

#endif
