// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_BASE_CEF_BASICTYPES_H_
#define CEF_INCLUDE_BASE_CEF_BASICTYPES_H_
#pragma once

#include <stddef.h>
#include <stdint.h>

#if defined(__clang__) || defined(__GNUC__)
#define CEF_USE_ATTRIBUTE_DEPRECATED 1
#endif

typedef signed char int8;
typedef unsigned char uint8;
typedef short int16;
typedef unsigned short uint16;
typedef int int32;
typedef unsigned int uint32;
typedef long long int64;
typedef unsigned long long uint64;

// Compatibility typedef for C++20 char16 usage
// In C++11+, char16_t is a built-in type and cannot be redefined.
#ifdef __cplusplus
#define CEF_BUILTIN_CHAR16_T 1
typedef char16_t char16;
#else
#if !defined(char16_t)
typedef unsigned short char16_t;
#endif
typedef char16_t char16;
#endif

#ifndef NULL
#define NULL 0
#endif

#endif  // CEF_INCLUDE_BASE_CEF_BASICTYPES_H_
