// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_CEF_PREFERENCE_H_
#define CEF_INCLUDE_CEF_PREFERENCE_H_
#pragma once

#include "include/cef_base.h"

enum cef_preferences_type_t {
  PREFERENCES_TYPE_BOOL,
  PREFERENCES_TYPE_INT,
  PREFERENCES_TYPE_STRING,
  PREFERENCES_TYPE_LIST,
  PREFERENCES_TYPE_DICT,
};

class CefPreference : public CefBaseRefCounted {
 public:
  virtual cef_preferences_type_t GetType() = 0;
  virtual bool GetBool() = 0;
  virtual void SetBool(bool value) = 0;
  virtual int GetInt() = 0;
  virtual void SetInt(int value) = 0;
  virtual CefString Get_string() = 0;
  virtual void Set_string(const CefString& value) = 0;
};

#endif  // CEF_INCLUDE_CEF_PREFERENCE_H_
