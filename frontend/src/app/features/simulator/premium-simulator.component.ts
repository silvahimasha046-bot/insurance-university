import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WizardStateService } from '../../core/state/wizard-state.service';
import { CustomerAuthService } from '../../core/services/customer-auth.service';

@Component({
  standalone: true,
  selector: 'app-premium-simulator',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './premium-simulator.component.html',
})
export class PremiumSimulatorComponent {
  basePremium = 12400;
  coverageMultiplier = 1.0;
  addCriticalIllness = false;
  addAccidentRider = false;
  isLoggedIn = false;

  constructor(private wizard: WizardStateService, private auth: CustomerAuthService) {
    this.isLoggedIn = this.auth.isLoggedIn();
    const plan = wizard.snapshot.selectedPlan;
    if (plan?.premiumLkrPerMonth) {
      this.basePremium = plan.premiumLkrPerMonth;
    }
  }

  get estimatedPremium(): number {
    let total = this.basePremium * this.coverageMultiplier;
    if (this.addCriticalIllness) total += this.basePremium * 0.15;
    if (this.addAccidentRider) total += this.basePremium * 0.08;
    return Math.round(total);
  }

  get coverageLabel(): string {
    return `${this.coverageMultiplier.toFixed(1)}×`;
  }
}
