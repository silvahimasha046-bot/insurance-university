import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-proposal-upload",
  standalone: true,
  imports: [RouterModule],
  templateUrl: "./proposal-upload.component.html",
})
export class ProposalUploadComponent {
  nicUploaded = false;
  medicalUploaded = false;
  incomeUploaded = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private http: HttpClient,
    private router: Router
  ) {
    const docs = wizard.snapshot.documents;
    if (docs) {
      this.nicUploaded = docs.nicUploaded ?? false;
      this.medicalUploaded = docs.medicalUploaded ?? false;
      this.incomeUploaded = docs.incomeUploaded ?? false;
    }
  }

  onFileSelected(docType: "nic" | "medical" | "income", event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const sessionId = this.customerApi.getStoredSessionId();
    if (!sessionId) return;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("docType", docType);

    this.http
      .post(`http://localhost:8080/api/customer/sessions/${sessionId}/documents`, fd)
      .subscribe({
        next: () => {
          if (docType === "nic") this.nicUploaded = true;
          if (docType === "medical") this.medicalUploaded = true;
          if (docType === "income") this.incomeUploaded = true;
          this.wizard.setDocuments({
            nicUploaded: this.nicUploaded,
            medicalUploaded: this.medicalUploaded,
            incomeUploaded: this.incomeUploaded,
          });
        },
        error: (err) => console.warn("Upload error", err),
      });
  }

  submit(): void {
    this.router.navigateByUrl("/proposal/missing");
  }
}
