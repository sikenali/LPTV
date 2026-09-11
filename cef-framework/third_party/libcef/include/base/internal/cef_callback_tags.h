// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_BASE_INTERNAL_CEF_CALLBACK_TAGS_H_
#define CEF_INCLUDE_BASE_INTERNAL_CEF_CALLBACK_TAGS_H_
#pragma once

namespace cef {
namespace internal {

struct is_unowned_tag {};
struct is_ref_counted_tag {};
struct is_tracked_tag {};
struct no_unweak_tag {};

}  // namespace internal
}  // namespace cef

#endif  // CEF_INCLUDE_BASE_INTERNAL_CEF_CALLBACK_TAGS_H_
