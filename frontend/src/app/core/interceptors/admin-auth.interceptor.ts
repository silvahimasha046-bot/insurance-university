import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'admin_access_token';
const API_PREFIX = 'http://localhost:8080/api/';

export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && req.url.startsWith(API_PREFIX)) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }
  return next(req);
};
