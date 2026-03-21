import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';
import { CustomerApiService } from '../../../core/customer-api.service';

export interface CustomerSession {
  sessionId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer-dashboard.component.html',
})
export class CustomerDashboardComponent implements OnInit {
  userName = '';
  userEmail = '';

  sessions: CustomerSession[] = [];
  sessionsLoading = true;
  sessionsError = false;

  constructor(
    private auth: CustomerAuthService,
    private customerApi: CustomerApiService,
  ) {}

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

    this.loadSessions();
  }

  loadSessions(): void {
    this.sessionsLoading = true;
    this.sessionsError = false;
    this.customerApi.listSessions().subscribe({
      next: (data) => {
        this.sessions = data as CustomerSession[];
        this.sessionsLoading = false;
      },
      error: () => {
        this.sessionsError = true;
        this.sessionsLoading = false;
      },
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
