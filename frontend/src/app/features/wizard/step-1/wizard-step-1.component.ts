import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-wizard-step-1",
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: "./wizard-step-1.component.html",
})
export class WizardStep1Component implements OnInit {
  needsText = "";

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step1;
    if (typeof s?.needsText === "string") this.needsText = s.needsText;
  }

  ngOnInit(): void {
    // Create a new session when the wizard starts (if one doesn't exist yet)
    if (!this.customerApi.getStoredSessionId()) {
      this.customerApi.createSession().subscribe({
        next: (res) => this.customerApi.storeSessionId(res.sessionId),
        error: (err) => console.warn("Could not create customer session", err),
      });
    }
  }

  persist(): void {
    this.wizard.updateStep1({ needsText: this.needsText });
  }

  next(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId && this.needsText) {
      this.customerApi.submitAnswers(sessionId, { needsText: this.needsText }).subscribe({
        error: (err) => console.warn("Could not save step-1 answers", err),
      });
    }
    this.router.navigateByUrl("/wizard/step-2");
  }
}