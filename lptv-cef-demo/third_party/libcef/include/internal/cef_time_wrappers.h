// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
//
// This file was created to bridge the gap between header versions.

#ifndef CEF_INCLUDE_INTERNAL_CEF_TIME_WRAPPERS_H_
#define CEF_INCLUDE_INTERNAL_CEF_TIME_WRAPPERS_H_
#pragma once

#include "include/internal/cef_time.h"

#ifdef __cplusplus

///
// C++ wrapper class for cef_time_t.
///
class CefTime {
 public:
  cef_time_t struct_type;

  CefTime() { Init(); }
  explicit CefTime(const cef_time_t& other) { struct_type = other; }
  
  void Init() {
    memset(&struct_type, 0, sizeof(struct_type));
  }
  
  bool IsSet() const {
    return struct_type.year != 0;
  }
};

#endif  // __cplusplus

#endif  // CEF_INCLUDE_INTERNAL_CEF_TIME_WRAPPERS_H_
