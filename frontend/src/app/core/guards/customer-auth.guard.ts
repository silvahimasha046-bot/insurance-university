import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerAuthGuard: CanMatchFn = () => {
  const auth = inject(CustomerAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.parseUrl('/login');
};
