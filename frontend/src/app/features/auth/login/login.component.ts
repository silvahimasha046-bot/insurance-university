import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';
import { CustomerApiService } from '../../../core/customer-api.service';
import { WizardStateService } from '../../../core/state/wizard-state.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  errorVisible = false;
  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private customerAuth: CustomerAuthService,
    private customerApi: CustomerApiService,
    private wizard: WizardStateService,
    private cd: ChangeDetectorRef,
  ) {}

  login(): void {
    this.errorVisible = false;
    this.loading = true;
    this.http
      .post<{ token: string; name: string; email: string }>('http://localhost:8080/api/auth/login', {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.customerApi.clearSessionData();
          this.wizard.clear();
          this.customerAuth.storeSession(res.token, res.name, res.email);
          this.loading = false;
          this.cd.detectChanges();
          this.router.navigateByUrl('/customer/dashboard');
        },
        error: () => {
          this.loading = false;
          this.errorVisible = true;
          this.cd.detectChanges();
        },
      });
  }
}