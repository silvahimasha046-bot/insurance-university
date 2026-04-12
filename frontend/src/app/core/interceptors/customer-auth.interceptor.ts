import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'insurance_auth_token';
const API_PREFIX = 'http://localhost:8080/api/';

export const customerAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  // Attach the customer token for non-admin API requests.
  // This keeps customer flows working even if an admin token also exists.
  const isAdminRequest = req.url.includes('/api/admin/');
  if (token && req.url.startsWith(API_PREFIX) && !isAdminRequest) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};
