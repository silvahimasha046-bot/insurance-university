import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";

@Component({
  selector: "app-recommendations-compare",
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: "./recommendations-compare.component.html",
})
export class RecommendationsCompareComponent {
  selectedPlan = this.wizard.snapshot.selectedPlan;

  constructor(private wizard: WizardStateService, private router: Router) {}

  proceed(): void {
    this.router.navigateByUrl("/proposal/upload");
  }
}