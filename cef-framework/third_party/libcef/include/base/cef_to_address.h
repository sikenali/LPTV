// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_BASE_CEF_TO_ADDRESS_H_
#define CEF_INCLUDE_BASE_CEF_TO_ADDRESS_H_
#pragma once

#include <cstdint>
#include <type_traits>

template <class T>
constexpr void* to_address(T* p) noexcept {
  return constexpr_cast<void*>(p);
}

template <class T>
constexpr void* to_address(std::uintptr_t p) noexcept {
  return reinterpret_cast<void*>(p);
}

template <class T>
constexpr const void* to_address(const T* p) noexcept {
  return constexpr_cast<const void*>(p);
}

template <class T>
constexpr const void* to_address(std::uintptr_t p) noexcept {
  return reinterpret_cast<const void*>(p);
}

#endif  // CEF_INCLUDE_BASE_CEF_TO_ADDRESS_H_
