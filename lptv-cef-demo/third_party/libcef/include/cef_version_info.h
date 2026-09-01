// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_CEF_VERSION_INFO_H_
#define CEF_INCLUDE_CEF_VERSION_INFO_H_
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _cef_version_info_t {
  int major_version;
  int minor_version;
  int build;
  int patch;
  char commit_hash[16];
} cef_version_info_t;

#ifdef __cplusplus
}
#endif

#endif  // CEF_INCLUDE_CEF_VERSION_INFO_H_
