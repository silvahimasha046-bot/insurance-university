import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { WizardStateService } from "../../core/state/wizard-state.service";

@Component({
  selector: "app-premium-simulator",
  standalone: true,
  imports: [RouterModule],
  templateUrl: "./premium-simulator.component.html",
})
export class PremiumSimulatorComponent {
  basePremium = 12400;
  coverageMultiplier = 1.0;
  addCriticalIllness = false;
  addAccidentRider = false;

  constructor(private wizard: WizardStateService) {
    const plan = wizard.snapshot.selectedPlan;
    if (plan) {
      this.basePremium = plan.premiumLkrPerMonth;
    }
  }

  get estimatedPremium(): number {
    let total = this.basePremium * this.coverageMultiplier;
    if (this.addCriticalIllness) total += this.basePremium * 0.15;
    if (this.addAccidentRider) total += this.basePremium * 0.08;
    return Math.round(total);
  }
}
