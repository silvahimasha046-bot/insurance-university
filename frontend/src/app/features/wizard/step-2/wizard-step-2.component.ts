import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { WizardStateService } from "../../../core/state/wizard-state.service";

@Component({
  selector: "app-wizard-step-2",
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: "./wizard-step-2.component.html",
})
export class WizardStep2Component {
  monthlyIncomeLkr = 75000;
  loansText = "";

  constructor(private wizard: WizardStateService) {
    const s = this.wizard.snapshot.step2;
    if (typeof s?.monthlyIncomeLkr === "number") this.monthlyIncomeLkr = s.monthlyIncomeLkr;
    if (typeof s?.loansText === "string") this.loansText = s.loansText;
  }

  persist() {
    const recommendedCoverageLkr = Math.max(10_000_000, Math.round(this.monthlyIncomeLkr * 120));
    this.wizard.updateStep2({
      monthlyIncomeLkr: this.monthlyIncomeLkr,
      loansText: this.loansText,
      recommendedCoverageLkr,
    });
  }
}