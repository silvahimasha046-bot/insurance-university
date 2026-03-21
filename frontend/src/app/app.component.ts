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
      <header class="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <a href="/" class="flex items-center gap-2 text-primary font-bold text-lg no-underline">
              <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white text-sm font-extrabold">IU</span>
              <span class="hidden sm:inline text-gray-900 dark:text-white">Insurance University</span>
            </a>
            <nav class="flex items-center gap-4 text-sm">
              <a href="/login"
                 class="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary font-medium no-underline transition-colors">
                Login
              </a>
              <a href="/register"
                 class="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90 no-underline transition-opacity">
                Get Started
              </a>
            </nav>
          </div>
        </div>
      </header>
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

