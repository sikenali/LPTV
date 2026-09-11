// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_CEF_SHARED_MEMORY_REGION_H_
#define CEF_INCLUDE_CEF_SHARED_MEMORY_REGION_H_
#pragma once

#include "include/cef_base.h"

class CefSharedMemoryRegion : public CefBaseRefCounted {
 public:
  virtual bool Create(const CefString& name, size_t size) = 0;
  virtual void* GetMemory() = 0;
  virtual size_t GetSize() = 0;
  virtual bool Close() = 0;
};

#endif  // CEF_INCLUDE_CEF_SHARED_MEMORY_REGION_H_
