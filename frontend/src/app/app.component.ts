import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    @if (!isAdminRoute()) {
      <main class="min-h-[calc(100vh-4rem)]">
        <router-outlet />
      </main>
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent {
  private router = inject(Router);

  private adminRoute$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(() => this.router.url.startsWith('/admin') || this.router.url.startsWith('/customer/dashboard')),
  );

  isAdminRoute = toSignal(this.adminRoute$, {
    initialValue: this.router.url.startsWith('/admin') || this.router.url.startsWith('/customer/dashboard'),
  });
}

