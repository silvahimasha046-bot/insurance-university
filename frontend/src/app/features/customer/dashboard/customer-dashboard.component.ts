import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';
import { CustomerApiService } from '../../../core/customer-api.service';
import { finalize, take } from 'rxjs';

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
    private cd: ChangeDetectorRef
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
          this.cd.detectChanges();
        },
        error: () => this.cd.detectChanges(),
      });
    }

    this.loadSessions();
  }

  loadSessions(): void {
    console.log("Loading sessions...");
    this.sessionsLoading = true;
    this.sessionsError = false;
    this.customerApi.listSessions().pipe(
        take(1),
        finalize(() => {
          this.sessionsLoading = false;
          this.cd.detectChanges();
          console.log("Session Loading:", this.sessionsLoading);
        })
      ).subscribe({
      next: (data) => {
        this.sessions = data as CustomerSession[];
        console.log("Loaded sessions:", this.sessions);
        console.log("Session Loading:", this.sessionsLoading);
        this.cd.detectChanges();
      },
      error: () => {
        this.sessionsError = true;
        console.log("Failed to load sessions.");
        this.cd.detectChanges();
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
