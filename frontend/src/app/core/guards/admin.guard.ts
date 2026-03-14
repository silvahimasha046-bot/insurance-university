import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AdminAuthService } from '../../features/admin/admin-auth.service';

export const adminGuard: CanMatchFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.parseUrl('/admin/login');
};
