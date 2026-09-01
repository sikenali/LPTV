// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_BASE_CEF_IS_INSTANTIATION_H_
#define CEF_INCLUDE_BASE_CEF_IS_INSTANTIATION_H_
#pragma once

#include <type_traits>

template <class T, class = void>
struct is_instantiation : std::false_type {};

template <class T>
struct is_instantiation<T, decltype((void)sizeof(T), void())> : std::true_type {};

#endif  // CEF_INCLUDE_BASE_CEF_IS_INSTANTIATION_H_
