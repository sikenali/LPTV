// Copyright (c) 2023 Marshall A. Greenblatt. All rights reserved.
// Stub header for compatibility.

#ifndef CEF_INCLUDE_CEF_PERMISSION_HANDLER_H_
#define CEF_INCLUDE_CEF_PERMISSION_HANDLER_H_
#pragma once

#include "include/cef_base.h"
#include "include/cef_request.h"

class CefPermissionRequest;
typedef base::RefCounted<CefPermissionRequest> CefPermissionRequestRef;

///
// Used for implementing cef_permission_handler_t::OnSelectPermission().
///
class CefPermissionRequest : public CefBaseRefCounted {
 public:
  ///
  // Accept the permission request.
  ///
  virtual void Accept() = 0;

  ///
  // Reject the permission request.
  ///
  virtual void Reject() = 0;

  ///
  // Returns true if the request has been accepted or rejected.
  ///
  virtual bool IsAcknowledged() = 0;
};

///
// Class used for implementing cef_permission_handler. The class may be
// deployed on any thread.
///
class CefPermissionHandler : public CefBaseRefCounted {
 public:
  ///
  // Called when a page requests permission to use a feature. Return true and
  // call cef_permission_request_t::Accept() or cef_permission_request_t::Reject()
  // to grant or deny the request. If this handler is not implemented the
  // request will be denied by default.
  ///
  virtual bool OnSelectPermission(CefRefPtr<CefBrowser> browser,
                                  const CefString& url,
                                  int flags,
                                  bool user_gesture,
                                  CefRefPtr<CefPermissionRequest> request) {
    return false;
  }
};

#endif  // CEF_INCLUDE_CEF_PERMISSION_HANDLER_H_
