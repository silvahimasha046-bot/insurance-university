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

  /** Policy type filter — "All" shows everything */
  policyTypeFilter = "All";

  readonly policyTypes = ["All", "Life", "Retirement", "Investment", "Critical Illness"];

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
          this.applyFilters();
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
              eligibilityDecision: "Eligible",
              predictedCoverage: 5400000,
              suitabilityRank: 1,
              riderExclusions: [],
            },
          ];
          this.applyFilters();
        },
      });
    }
  }

  applyFilters(): void {
    let filtered = [...this.allProducts];
    if (this.policyTypeFilter !== "All") {
      filtered = filtered.filter((p) =>
        p.policyType?.toLowerCase().includes(this.policyTypeFilter.toLowerCase())
      );
    }
    if (this.sortKey === "price") {
      filtered.sort((a, b) => a.monthlyPremiumEstimate - b.monthlyPremiumEstimate);
    } else if (this.sortKey === "affordability") {
      filtered.sort((a, b) => (b.affordabilityScore ?? 0) - (a.affordabilityScore ?? 0));
    } else {
      filtered.sort((a, b) => b.score - a.score);
    }
    this.rankedProducts = filtered;
  }

  applySort(): void {
    this.applyFilters();
  }

  setSortKey(key: string): void {
    this.sortKey = key as SortKey;
    this.applyFilters();
  }

  setPolicyTypeFilter(type: string): void {
    this.policyTypeFilter = type;
    this.applyFilters();
  }

  eligibilityBadgeClass(decision: string | undefined): string {
    if (!decision) return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
    const d = decision.toLowerCase();
    if (d === "eligible") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (d === "no offer") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  }

  selectPlanAndGoCompare(product: RankedProduct) {
    if (product.eligibilityDecision === "No Offer") return;
    this.wizard.setSelectedPlan({
      id: product.code,
      name: product.name,
      premiumLkrPerMonth: product.monthlyPremiumEstimate,
      matchPercent: Math.round(product.score * 100),
      eligibilityDecision: product.eligibilityDecision,
      predictedCoverage: product.predictedCoverage,
      policyType: product.policyType,
      riderExclusions: product.riderExclusions,
      reasons: product.reasons,
    });
    this.router.navigateByUrl("/recommendations/compare");
  }
}
