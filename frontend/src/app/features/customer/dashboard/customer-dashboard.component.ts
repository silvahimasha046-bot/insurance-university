import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';
import { CustomerApiService, CustomerSession } from '../../../core/customer-api.service';
import { finalize, take } from 'rxjs';
import { WizardStateService } from '../../../core/state/wizard-state.service';

type SessionTarget = 'recommendations' | 'simulator' | 'compare';

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
  pickerSessions: CustomerSession[] = [];
  sessionsLoading = true;
  sessionsError = false;

  showSessionPicker = false;
  pickerLoading = false;
  pickerError = false;
  pickerTarget: SessionTarget = 'recommendations';

  constructor(
    private auth: CustomerAuthService,
    private customerApi: CustomerApiService,
    private wizard: WizardStateService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  get hasCompletedSessions(): boolean {
    return this.sessions.some((session) => session.status === 'COMPLETED');
  }

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
    this.sessionsLoading = true;
    this.sessionsError = false;
    this.customerApi.listSessions().pipe(
        take(1),
        finalize(() => {
          this.sessionsLoading = false;
          this.cd.detectChanges();
        })
      ).subscribe({
      next: (data) => {
        this.sessions = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.sessionsError = true;
        this.cd.detectChanges();
      },
    });
  }

  startAssessment(): void {
    this.customerApi.clearSessionData();
    this.wizard.clear();
    this.wizard.setRecommendationsEntrySource(undefined);
    this.wizard.setSimulatorEntrySource(undefined);
    this.wizard.setCompareEntrySource(undefined);
    this.wizard.setUploadEntrySource(undefined);
    this.customerApi.createSession().pipe(take(1)).subscribe({
      next: (res) => {
        const createdAt = new Date().toISOString();
        this.customerApi.storeSessionId(res.sessionId);
        this.customerApi.storeActiveSessionMeta({ sessionId: res.sessionId, createdAt });
        this.router.navigateByUrl('/wizard/step-1');
      },
      error: () => {
        this.sessionsError = true;
        this.cd.detectChanges();
      },
    });
  }

  openUploadProposal(): void {
    this.customerApi.clearSessionData();
    this.wizard.clear();
    this.wizard.setUploadEntrySource('dashboard');
    this.customerApi.createSession().pipe(take(1)).subscribe({
      next: (res) => {
        const createdAt = new Date().toISOString();
        this.customerApi.storeSessionId(res.sessionId);
        this.customerApi.storeActiveSessionMeta({ sessionId: res.sessionId, createdAt });
        this.router.navigateByUrl('/proposal/upload');
      },
      error: () => {
        this.sessionsError = true;
        this.cd.detectChanges();
      },
    });
  }

  openSessionPicker(target: SessionTarget): void {
    this.pickerTarget = target;
    this.showSessionPicker = true;
    this.pickerLoading = true;
    this.pickerError = false;

    this.customerApi.listSessions().pipe(
      take(1),
      finalize(() => {
        this.pickerLoading = false;
        this.cd.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        if (target === 'recommendations' || target === 'simulator' || target === 'compare') {
          this.pickerSessions = data.filter((session) => session.status === 'COMPLETED');
        } else {
          this.pickerSessions = data;
        }
      },
      error: () => {
        this.pickerError = true;
      },
    });
  }

  closeSessionPicker(): void {
    this.showSessionPicker = false;
  }

  selectSessionAndNavigate(session: CustomerSession): void {
    this.customerApi.storeSessionId(session.sessionId);
    this.customerApi.storeActiveSessionMeta({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
    });
    this.showSessionPicker = false;

    if (this.pickerTarget === 'recommendations' || this.pickerTarget === 'compare') {
      this.wizard.setRecommendationsEntrySource('dashboard');
    } else {
      this.wizard.setRecommendationsEntrySource(undefined);
    }

    if (this.pickerTarget === 'simulator') {
      this.wizard.setSimulatorEntrySource('dashboard');
    } else {
      this.wizard.setSimulatorEntrySource(undefined);
    }

    if (this.pickerTarget === 'compare') {
      this.wizard.setCompareEntrySource('dashboard');
    } else {
      this.wizard.setCompareEntrySource(undefined);
    }

    if (this.pickerTarget === 'simulator') {
      this.router.navigateByUrl('/simulator');
      return;
    }
    if (this.pickerTarget === 'compare') {
      this.router.navigateByUrl('/recommendations/compare');
      return;
    }
    this.router.navigateByUrl('/recommendations');
  }

  viewResults(session: CustomerSession): void {
    this.customerApi.storeSessionId(session.sessionId);
    this.customerApi.storeActiveSessionMeta({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
    });
    this.wizard.setRecommendationsEntrySource('dashboard');
    this.wizard.setSimulatorEntrySource(undefined);
    this.wizard.setCompareEntrySource(undefined);
    this.wizard.setUploadEntrySource(undefined);
    this.router.navigateByUrl('/recommendations');
  }

  continueSession(session: CustomerSession): void {
    this.customerApi.storeSessionId(session.sessionId);
    this.customerApi.storeActiveSessionMeta({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
    });
    this.wizard.setRecommendationsEntrySource(undefined);
    this.wizard.setSimulatorEntrySource(undefined);
    this.wizard.setCompareEntrySource(undefined);
    this.wizard.setUploadEntrySource(undefined);
    this.router.navigateByUrl('/wizard/step-1');
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
    this.wizard.setRecommendationsEntrySource(undefined);
    this.wizard.setSimulatorEntrySource(undefined);
    this.wizard.setCompareEntrySource(undefined);
    this.wizard.setUploadEntrySource(undefined);
    this.auth.logout();
  }
}
