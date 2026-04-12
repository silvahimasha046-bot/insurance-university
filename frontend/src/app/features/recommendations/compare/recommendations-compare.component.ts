import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerAuthService } from "../../../core/services/customer-auth.service";

@Component({
  selector: "app-recommendations-compare",
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: "./recommendations-compare.component.html",
})
export class RecommendationsCompareComponent {
  selectedPlan: WizardStateService["snapshot"]["selectedPlan"];
  isLoggedIn = false;
  isDashboardJourney = false;
  private compareEntrySource?: "dashboard" | "recommendations";

  constructor(
    private wizard: WizardStateService,
    private router: Router,
    private auth: CustomerAuthService
  ) {
    this.selectedPlan = this.wizard.snapshot.selectedPlan;
    this.isLoggedIn = this.auth.isLoggedIn();
    this.compareEntrySource = this.wizard.snapshot.compareEntrySource;
    this.isDashboardJourney = this.wizard.snapshot.recommendationsEntrySource === 'dashboard'
      || this.compareEntrySource === 'dashboard';
  }

  goBack(): void {
    if (this.compareEntrySource === 'dashboard') {
      this.router.navigateByUrl('/customer/dashboard');
      return;
    }
    this.router.navigateByUrl('/recommendations');
  }

  proceed(): void {
    this.wizard.setUploadEntrySource(undefined);
    this.router.navigateByUrl("/proposal/upload");
  }
}