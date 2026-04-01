import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private auth: AdminAuthService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.cd.detectChanges();
        this.router.navigate(['/admin']);
      },
      error: () => {
        this.error = 'Invalid credentials';
        this.loading = false;
        this.cd.detectChanges();
      },
    });
  }
}
