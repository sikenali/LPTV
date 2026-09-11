// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_CEF_UNRESPONSIVE_PROCESS_CALLBACK_H_
#define CEF_INCLUDE_CEF_UNRESPONSIVE_PROCESS_CALLBACK_H_
#pragma once

#include "include/cef_base.h"

class CefUnresponsiveProcessCallback : public CefBaseRefCounted {
 public:
  virtual void Continue() = 0;
  virtual void Terminate() = 0;
};

#endif  // CEF_INCLUDE_CEF_UNRESPONSIVE_PROCESS_CALLBACK_H_
