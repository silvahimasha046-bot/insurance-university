import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";

@Component({
  selector: "app-proposal-summary",
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: "./proposal-summary.component.html",
})
export class ProposalSummaryComponent implements OnInit {
  selectedPlan = this.wizard.snapshot.selectedPlan;
  missingFields = this.wizard.snapshot.missingFields;
  documents = this.wizard.snapshot.documents;
  step2 = this.wizard.snapshot.step2;
  proposalRef = '';
  today = new Date();

  constructor(private wizard: WizardStateService) {}

  ngOnInit(): void {
    const ts = Date.now().toString(36).toUpperCase();
    this.proposalRef = `PROP-${ts}-IU`;
  }

  printProposal(): void {
    window.print();
  }
}