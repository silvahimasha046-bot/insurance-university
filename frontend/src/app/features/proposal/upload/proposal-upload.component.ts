import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WizardStateService } from '../../../core/state/wizard-state.service';
import {
  CustomerApiService,
  DocumentSide,
  DocumentType,
  UploadedDocumentMeta,
} from '../../../core/customer-api.service';
import { CustomerAuthService } from '../../../core/services/customer-auth.service';

@Component({
  standalone: true,
  selector: 'app-proposal-upload',
  imports: [RouterModule, CommonModule],
  templateUrl: './proposal-upload.component.html',
})
export class ProposalUploadComponent {
  nicFrontUploaded = false;
  nicBackUploaded = false;
  medicalUploaded = false;
  incomeUploaded = false;

  nicFrontUploading = false;
  nicBackUploading = false;
  medicalUploading = false;
  incomeUploading = false;

  nicFrontMeta?: UploadedDocumentMeta;
  nicBackMeta?: UploadedDocumentMeta;
  medicalMeta?: UploadedDocumentMeta;
  incomeMeta?: UploadedDocumentMeta;

  errorMessage = '';
  isDashboardJourney = false;
  isContinuingSession = false;
  private sessionId: string | null = null;
  private sessionValidated = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {
    this.isDashboardJourney = this.wizard.snapshot.uploadEntrySource === 'dashboard';
    this.isContinuingSession = this.wizard.snapshot.isContinuingSession ?? false;
    const docs = this.wizard.snapshot.documents;
    if (docs) {
      this.nicFrontUploaded = docs.nicFrontUploaded ?? docs.nicUploaded ?? false;
      this.nicBackUploaded = docs.nicBackUploaded ?? docs.nicUploaded ?? false;
      this.medicalUploaded = docs.medicalUploaded ?? false;
      this.incomeUploaded = docs.incomeUploaded ?? false;
    }

    this.loadPersistedDocuments();
  }

  get nicUploaded(): boolean {
    return this.nicFrontUploaded && this.nicBackUploaded;
  }

  onFileSelected(docType: DocumentType, event: Event, docSide?: DocumentSide): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    const file = input.files[0];
    this.errorMessage = '';
    this.setUploadingState(docType, docSide, true);

    this.ensureSessionId((sessionId) => {
      this.customerApi.uploadSessionDocument(sessionId, docType, file, docSide).subscribe({
        next: () => {
          this.setUploadingState(docType, docSide, false);
          this.refreshDocuments(sessionId);
          this.cd.detectChanges();
          input.value = '';
        },
        error: () => {
          this.errorMessage = 'Upload failed. Please retry.';
          this.setUploadingState(docType, docSide, false);
          this.cd.detectChanges();
          input.value = '';
        },
      });
    });
  }

  downloadDocument(docType: DocumentType, docSide?: DocumentSide): void {
    const meta = this.getMeta(docType, docSide);
    if (!meta?.documentId) {
      return;
    }
    const sessionId = this.sessionId ?? this.customerApi.getStoredSessionId();
    if (!sessionId) {
      this.errorMessage = 'Session not found for download.';
      return;
    }

    this.customerApi.downloadSessionDocument(sessionId, meta.documentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = meta.originalFilename || 'document';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage = 'Download failed. Please retry.';
      },
    });
  }

  canSubmit(): boolean {
    return this.nicFrontUploaded && this.nicBackUploaded;
  }

  getUploadDate(meta?: UploadedDocumentMeta): string {
    if (!meta?.uploadedAt) {
      return '';
    }
    const parsed = new Date(meta.uploadedAt);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleString();
  }

  goBack(): void {
    if (this.isDashboardJourney) {
      this.router.navigateByUrl('/customer/dashboard');
      return;
    }
    this.router.navigateByUrl('/recommendations/compare');
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.errorMessage = 'NIC front and NIC back are required.';
      return;
    }
    this.router.navigateByUrl('/proposal/missing');
  }

  private loadPersistedDocuments(): void {
    this.resolveExistingSession((sessionId) => {
      this.sessionId = sessionId;
      this.refreshDocuments(sessionId);
    });
  }

  private loadSessionDocuments(sessionId: string): void {
    this.customerApi.getSessionDocuments(sessionId).subscribe({
      next: (response) => {
        this.sessionValidated = true;
        this.applyDocuments(response.documents, true);
        this.updateWizardDocumentsState();
        this.cd.detectChanges();
      },
      error: () => {
        this.sessionValidated = false;
        this.cd.detectChanges();
      },
    });
  }

  private refreshDocuments(sessionId: string): void {
    if (this.auth.isLoggedIn()) {
      this.customerApi.getLatestUserDocuments().subscribe({
        next: (latest) => {
          this.applyDocuments(latest.documents, false);
          this.loadSessionDocuments(sessionId);
        },
        error: () => {
          this.loadSessionDocuments(sessionId);
        },
      });
      return;
    }

    this.loadSessionDocuments(sessionId);
  }

  private applyDocuments(docs: UploadedDocumentMeta[], overrideExisting: boolean): void {
    for (const doc of docs ?? []) {
      this.applyDocument(doc, overrideExisting);
    }
  }

  private applyDocument(doc: UploadedDocumentMeta, overrideExisting: boolean): void {
    if (doc.docType === 'nic' && doc.docSide === 'front' && (overrideExisting || !this.nicFrontUploaded)) {
      this.nicFrontUploaded = true;
      this.nicFrontMeta = doc;
    }
    if (doc.docType === 'nic' && doc.docSide === 'back' && (overrideExisting || !this.nicBackUploaded)) {
      this.nicBackUploaded = true;
      this.nicBackMeta = doc;
    }
    if (doc.docType === 'medical' && (overrideExisting || !this.medicalUploaded)) {
      this.medicalUploaded = true;
      this.medicalMeta = doc;
    }
    if (doc.docType === 'income' && (overrideExisting || !this.incomeUploaded)) {
      this.incomeUploaded = true;
      this.incomeMeta = doc;
    }
  }

  private updateWizardDocumentsState(): void {
    this.wizard.setDocuments({
      nicFrontUploaded: this.nicFrontUploaded,
      nicBackUploaded: this.nicBackUploaded,
      nicUploaded: this.nicUploaded,
      medicalUploaded: this.medicalUploaded,
      incomeUploaded: this.incomeUploaded,
    });
  }

  private ensureSessionId(onReady: (sessionId: string) => void): void {
    if (this.sessionId) {
      if (!this.auth.isLoggedIn() || this.sessionValidated) {
        onReady(this.sessionId);
        return;
      }

      this.customerApi.getSessionDocuments(this.sessionId).subscribe({
        next: () => {
          this.sessionValidated = true;
          onReady(this.sessionId as string);
        },
        error: () => {
          this.resolveExistingSession((sessionId) => {
            this.sessionId = sessionId;
            onReady(sessionId);
          });
        },
      });
      return;
    }

    this.resolveExistingSession((sessionId) => {
      this.sessionId = sessionId;
      onReady(sessionId);
    });
  }

  private resolveExistingSession(onReady: (sessionId: string) => void): void {
    const storedSessionId = this.customerApi.getStoredSessionId();
    if (storedSessionId) {
      this.sessionValidated = false;
      onReady(storedSessionId);
      return;
    }

    if (this.auth.isLoggedIn()) {
      this.customerApi.listSessions().subscribe({
        next: (sessions) => {
          const reusableSession = this.pickLatestReusableSession(sessions);
          if (reusableSession) {
            this.customerApi.storeSessionId(reusableSession.sessionId);
            this.customerApi.storeActiveSessionMeta({
              sessionId: reusableSession.sessionId,
              createdAt: reusableSession.createdAt,
            });
            this.wizard.setPartial({
              continuationSessionId: reusableSession.sessionId,
              isContinuingSession: true,
            });
            this.sessionValidated = false;
            onReady(reusableSession.sessionId);
            return;
          }
          this.createFreshSession(onReady);
        },
        error: () => {
          this.createFreshSession(onReady);
        },
      });
      return;
    }

    this.createFreshSession(onReady);
  }

  private pickLatestReusableSession(
    sessions: Array<{ sessionId: string; status: string; createdAt: string }>
  ): { sessionId: string; status: string; createdAt: string } | undefined {
    return sessions.find((session) => session.status === 'ACTIVE') ?? sessions[0];
  }

  private createFreshSession(onReady?: (sessionId: string) => void): void {
    this.customerApi.createSession().subscribe({
      next: (response) => {
        this.sessionId = response.sessionId;
        this.sessionValidated = true;
        this.customerApi.storeSessionId(response.sessionId);
        this.customerApi.storeActiveSessionMeta({
          sessionId: response.sessionId,
          createdAt: new Date().toISOString(),
        });
        this.wizard.setPartial({
          continuationSessionId: response.sessionId,
          isContinuingSession: true,
        });
        onReady?.(response.sessionId);
      },
      error: () => {
        this.errorMessage = 'Unable to create session. Please retry.';
      },
    });
  }

  private setUploadingState(docType: DocumentType, docSide: DocumentSide | undefined, uploading: boolean): void {
    if (docType === 'nic' && docSide === 'front') {
      this.nicFrontUploading = uploading;
      return;
    }
    if (docType === 'nic' && docSide === 'back') {
      this.nicBackUploading = uploading;
      return;
    }
    if (docType === 'medical') {
      this.medicalUploading = uploading;
      return;
    }
    if (docType === 'income') {
      this.incomeUploading = uploading;
    }
  }

  private getMeta(docType: DocumentType, docSide?: DocumentSide): UploadedDocumentMeta | undefined {
    if (docType === 'nic' && docSide === 'front') {
      return this.nicFrontMeta;
    }
    if (docType === 'nic' && docSide === 'back') {
      return this.nicBackMeta;
    }
    if (docType === 'medical') {
      return this.medicalMeta;
    }
    if (docType === 'income') {
      return this.incomeMeta;
    }
    return undefined;
  }
}
