import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { WizardStateService } from "../../core/state/wizard-state.service";
import { CustomerApiService, RankedProduct } from "../../core/customer-api.service";

type SortKey = "suitability" | "price" | "affordability";

@Component({
  selector: "app-recommendations",
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: "./recommendations.component.html",
})
export class RecommendationsComponent implements OnInit {
  allProducts: RankedProduct[] = [];
  rankedProducts: RankedProduct[] = [];
  loading = false;
  error: string | null = null;
  sortKey: SortKey = "suitability";

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
          this.allProducts = res.rankedProducts;
          this.applySort();
          this.loading = false;
        },
        error: (err) => {
          console.warn("Could not fetch recommendations from backend", err);
          this.error = "Could not load recommendations. Please ensure the backend is running.";
          this.loading = false;
          this.allProducts = [
            {
              code: "TERM-BASIC",
              name: "Term Life Basic",
              policyType: "Life",
              score: 0.75,
              monthlyPremiumEstimate: 3500,
              affordabilityScore: 0.85,
              lapseProbability: 0.12,
              reasons: ["Good coverage for your profile"],
            },
          ];
          this.applySort();
        },
      });
    }
  }

  applySort(): void {
    const sorted = [...this.allProducts];
    if (this.sortKey === "price") {
      sorted.sort((a, b) => a.monthlyPremiumEstimate - b.monthlyPremiumEstimate);
    } else if (this.sortKey === "affordability") {
      sorted.sort((a, b) => (b.affordabilityScore ?? 0) - (a.affordabilityScore ?? 0));
    } else {
      sorted.sort((a, b) => b.score - a.score);
    }
    this.rankedProducts = sorted;
  }

  setSortKey(key: string): void {
    this.sortKey = key as SortKey;
    this.applySort();
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