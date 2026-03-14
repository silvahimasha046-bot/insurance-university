import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../core/state/wizard-state.service";
import { CustomerApiService, RankedProduct } from "../../core/customer-api.service";

@Component({
  selector: "app-recommendations",
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: "./recommendations.component.html",
})
export class RecommendationsComponent implements OnInit {
  rankedProducts: RankedProduct[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private wizard: WizardStateService,
    private router: Router,
    private customerApi: CustomerApiService
  ) {}

  ngOnInit(): void {
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.loading = true;
      this.customerApi.getRecommendations(sessionId).subscribe({
        next: (res) => {
          this.rankedProducts = res.rankedProducts;
          this.loading = false;
        },
        error: (err) => {
          console.warn("Could not fetch recommendations from backend", err);
          this.error = "Could not load recommendations. Showing default.";
          this.loading = false;
          // Fall back to static recommendation
          this.rankedProducts = [
            {
              code: "SLP-2023-001",
              name: "Smart Life Protector",
              score: 0.95,
              monthlyPremiumEstimate: 4250,
              reasons: ["Best value for your profile"],
            },
          ];
        },
      });
    }
  }

  selectPlanAndGoCompare(product: RankedProduct) {
    this.wizard.setSelectedPlan({
      id: product.code,
      name: product.name,
      premiumLkrPerMonth: product.monthlyPremiumEstimate,
      matchPercent: Math.round(product.score * 100),
    });
    this.router.navigateByUrl("/recommendations/compare");
  }
}