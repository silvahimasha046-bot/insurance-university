import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';

@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer-dashboard.component.html',
})
export class CustomerDashboardComponent implements OnInit {
  userName = '';
  userEmail = '';

  constructor(private auth: CustomerAuthService) {}

  ngOnInit(): void {
    this.userName = this.auth.getUserName();
    this.userEmail = this.auth.getUserEmail();

    // Refresh from backend if localStorage values are missing
    if (!this.userName) {
      this.auth.getProfile().subscribe({
        next: (profile) => {
          this.userName = profile.name;
          this.userEmail = profile.email;
          const token = this.auth.getToken();
          if (token) {
            this.auth.storeSession(token, profile.name, profile.email);
          }
        },
      });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
