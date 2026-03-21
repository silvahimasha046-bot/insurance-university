import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

const CONSENT_KEY = "insurance_privacy_consent_v1";

@Component({
  selector: "app-wizard-step-1",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./wizard-step-1.component.html",
})
export class WizardStep1Component implements OnInit {
  needsText = "";
  isPep = false;
  hasCriminalHistory = false;
  educationLevel: "Postgrad" | "Undergrad" | "College" | "HighSchool" | "Elementary" = "Undergrad";
  occupation = "";
  occupationHazardLevel = 1;

  showConsentModal = false;
  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step1;
    if (typeof s?.needsText === "string") this.needsText = s.needsText;
    if (typeof s?.isPep === "boolean") this.isPep = s.isPep;
    if (typeof s?.hasCriminalHistory === "boolean") this.hasCriminalHistory = s.hasCriminalHistory;
    if (s?.educationLevel) this.educationLevel = s.educationLevel;
    if (typeof s?.occupation === "string") this.occupation = s.occupation;
    if (typeof s?.occupationHazardLevel === "number") this.occupationHazardLevel = s.occupationHazardLevel;
  }

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem("insurance_auth_token");
    if (!localStorage.getItem(CONSENT_KEY)) {
      this.showConsentModal = true;
    }

    if (!this.customerApi.getStoredSessionId()) {
      this.customerApi.createSession().subscribe({
        next: (res) => this.customerApi.storeSessionId(res.sessionId),
        error: (err) => console.warn("Could not create customer session", err),
      });
    }
  }

  acceptConsent(): void {
    localStorage.setItem(CONSENT_KEY, "accepted");
    this.showConsentModal = false;
  }

  declineConsent(): void {
    this.router.navigateByUrl("/");
  }

  withdrawConsent(): void {
    localStorage.removeItem(CONSENT_KEY);
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi.deleteSession(sessionId).subscribe({
        next: () => {},
        error: (err) => console.warn("Could not delete session from backend", err),
      });
      localStorage.removeItem("insurance_customer_session_id");
    }
    this.wizard.clear();
    this.router.navigateByUrl("/");
  }

  persist(): void {
    this.wizard.updateStep1({
      needsText: this.needsText,
      isPep: this.isPep,
      hasCriminalHistory: this.hasCriminalHistory,
      educationLevel: this.educationLevel,
      occupation: this.occupation,
      occupationHazardLevel: this.occupationHazardLevel,
    });
  }

  next(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi
        .submitAnswers(sessionId, {
          needsText: this.needsText,
          isPep: this.isPep,
          hasCriminalHistory: this.hasCriminalHistory,
          educationLevel: this.educationLevel,
          occupation: this.occupation,
          occupationHazardLevel: this.occupationHazardLevel,
        })
        .subscribe({
          error: (err) => console.warn("Could not save step-1 answers", err),
        });
    }
    this.router.navigateByUrl("/wizard/step-2");
  }
}
