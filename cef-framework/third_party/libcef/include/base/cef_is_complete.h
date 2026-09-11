// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_BASE_CEF_IS_COMPLETE_H_
#define CEF_INCLUDE_BASE_CEF_IS_COMPLETE_H_
#pragma once

#include <type_traits>

template <class T>
struct is_complete : std::integral_constant<bool, true> {};

#endif  // CEF_INCLUDE_BASE_CEF_IS_COMPLETE_H_
