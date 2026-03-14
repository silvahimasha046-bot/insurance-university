import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { WizardStateService } from "../../core/state/wizard-state.service";

@Component({
  selector: "app-recommendations",
  standalone: true,
  imports: [RouterModule],
  templateUrl: "./recommendations.component.html",
})
export class RecommendationsComponent {
  constructor(private wizard: WizardStateService, private router: Router) {}

  selectPlanAndGoCompare() {
    this.wizard.setSelectedPlan({
      id: "SLP-2023-001",
      name: "Smart Life Protector",
      premiumLkrPerMonth: 4250,
      matchPercent: 95,
    });
    this.router.navigateByUrl("/recommendations/compare");
  }
}