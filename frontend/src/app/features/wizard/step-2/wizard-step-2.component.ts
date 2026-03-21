import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-wizard-step-2",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./wizard-step-2.component.html",
})
export class WizardStep2Component implements OnInit {
  monthlyIncomeLkr = 75000;
  loansText = "";
  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step2;
    if (typeof s?.monthlyIncomeLkr === "number") this.monthlyIncomeLkr = s.monthlyIncomeLkr;
    if (typeof s?.loansText === "string") this.loansText = s.loansText;
  }

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem("insurance_auth_token");
  }

  persist() {
    const recommendedCoverageLkr = Math.max(10_000_000, Math.round(this.monthlyIncomeLkr * 120));
    this.wizard.updateStep2({
      monthlyIncomeLkr: this.monthlyIncomeLkr,
      loansText: this.loansText,
      recommendedCoverageLkr,
    });
  }

  next(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi
        .submitAnswers(sessionId, {
          monthlyIncomeLkr: this.monthlyIncomeLkr,
          loansText: this.loansText,
        })
        .subscribe({
          error: (err) => console.warn("Could not save step-2 answers", err),
        });
    }
    this.router.navigateByUrl("/wizard/step-3");
  }
}