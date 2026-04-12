import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-proposal-summary",
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: "./proposal-summary.component.html",
})
export class ProposalSummaryComponent implements OnInit {
  selectedPlan: any;
  missingFields: any;
  documents: any;
  step2: any;
  recommendationContext: any;
  proposalRef = '';
  today = new Date();

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.selectedPlan = this.wizard.snapshot.selectedPlan;
    this.missingFields = this.wizard.snapshot.missingFields;
    this.documents = this.wizard.snapshot.documents;
    this.step2 = this.wizard.snapshot.step2;
    this.recommendationContext = this.wizard.snapshot.recommendationContext;
    const ts = Date.now().toString(36).toUpperCase();
    this.proposalRef = `PROP-${ts}-IU`;
  }

  get followUpAnswerEntries(): Array<{ key: string; label: string; value: string }> {
    const raw = this.recommendationContext?.followUpAnswers ?? {};
    return Object.entries(raw).map(([key, value]) => ({
      key,
      label: this.toLabel(key),
      value: Array.isArray(value)
        ? value.join(", ")
        : typeof value === "boolean"
          ? (value ? "Yes" : "No")
          : String(value),
    }));
  }

  endSession(): void {
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi.completeSession(sessionId).subscribe({
        next: () => this.router.navigate(['/survey']),
        error: () => this.router.navigate(['/survey'])
      });
    } else {
      this.router.navigate(['/survey']);
    }
  }

  printProposal(): void {
    window.print();
  }

  private toLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }
}