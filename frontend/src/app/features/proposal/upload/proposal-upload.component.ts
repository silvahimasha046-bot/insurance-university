import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WizardStateService } from '../../../core/state/wizard-state.service';
import { CustomerApiService } from '../../../core/customer-api.service';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  selector: 'app-proposal-upload',
  imports: [RouterModule, CommonModule],
  templateUrl: './proposal-upload.component.html',
})
export class ProposalUploadComponent {
  nicUploaded = false;
  medicalUploaded = false;
  incomeUploaded = false;

  nicUploading = false;
  medicalUploading = false;
  incomeUploading = false;
  isDashboardJourney = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private http: HttpClient,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {
    this.isDashboardJourney = this.wizard.snapshot.uploadEntrySource === 'dashboard';
    const docs = wizard.snapshot.documents;
    if (docs) {
      this.nicUploaded = docs.nicUploaded ?? false;
      this.medicalUploaded = docs.medicalUploaded ?? false;
      this.incomeUploaded = docs.incomeUploaded ?? false;
    }
  }

  onFileSelected(docType: 'nic' | 'medical' | 'income', event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const sessionId = this.customerApi.getStoredSessionId();

    if (docType === 'nic') this.nicUploading = true;
    if (docType === 'medical') this.medicalUploading = true;
    if (docType === 'income') this.incomeUploading = true;

    const markDone = () => {
      if (docType === 'nic') { this.nicUploaded = true; this.nicUploading = false; }
      if (docType === 'medical') { this.medicalUploaded = true; this.medicalUploading = false; }
      if (docType === 'income') { this.incomeUploaded = true; this.incomeUploading = false; }
      this.wizard.setDocuments({
        nicUploaded: this.nicUploaded,
        medicalUploaded: this.medicalUploaded,
        incomeUploaded: this.incomeUploaded,
      });
      this.cd.detectChanges();
    };

    if (sessionId) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      this.http
        .post(`http://localhost:8080/api/customer/sessions/${sessionId}/documents`, fd)
        .subscribe({ next: () => markDone(), error: () => markDone() });
    } else {
      markDone();
    }
  }

  goBack(): void {
    if (this.isDashboardJourney) {
      this.router.navigateByUrl('/customer/dashboard');
      return;
    }
    this.router.navigateByUrl('/recommendations/compare');
  }

  submit(): void {
    this.router.navigateByUrl('/proposal/missing');
  }
}
