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
  selectedPlan = this.wizard.snapshot.selectedPlan;
  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private router: Router,
    private auth: CustomerAuthService
  ) {
    this.isLoggedIn = this.auth.isLoggedIn();
  }

  proceed(): void {
    this.router.navigateByUrl("/proposal/upload");
  }
}