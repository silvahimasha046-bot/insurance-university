import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { adminAuthInterceptor } from './app/core/interceptors/admin-auth.interceptor';
import { customerAuthInterceptor } from './app/core/interceptors/customer-auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([adminAuthInterceptor, customerAuthInterceptor])),
  ],
}).catch(err => console.error(err));
