import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'insurance_auth_token';
const ADMIN_TOKEN_KEY = 'admin_access_token';
const API_PREFIX = 'http://localhost:8080/api/';

export const customerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  // Only attach the customer token if the admin token is not present and
  // the request is not targeting an admin-only endpoint.
  const isAdminRequest = req.url.includes('/api/admin/');
  if (token && !localStorage.getItem(ADMIN_TOKEN_KEY) && req.url.startsWith(API_PREFIX) && !isAdminRequest) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};
