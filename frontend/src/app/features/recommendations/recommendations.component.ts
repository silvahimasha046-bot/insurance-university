import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { WizardStateService } from "../../core/state/wizard-state.service";
import {
  CustomerApiService,
  FollowUpQuestion,
  RankedProduct,
} from "../../core/customer-api.service";
import { CustomerAuthService } from "../../core/services/customer-auth.service";

@Component({
  selector: "app-recommendations",
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: "./recommendations.component.html",
})
export class RecommendationsComponent implements OnInit {
  allProducts: RankedProduct[] = [];
  rankedProducts: RankedProduct[] = [];
  followUpQuestions: FollowUpQuestion[] = [];
  followUpAnswers: Record<string, unknown> = {};
  loading = false;
  submittingFollowUps = false;
  error: string | null = null;
  followUpError: string | null = null;
  expandedCards = new Set<string>();
  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private router: Router,
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    this.followUpAnswers = {
      ...(this.wizard.snapshot.recommendationContext?.followUpAnswers ?? {}),
    };
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.loadRecommendations(sessionId);
      return;
    }

    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
    }
  }

  private loadRecommendations(sessionId: string): void {
    this.loading = true;
    this.customerApi.getRecommendations(sessionId).subscribe({
      next: (res) => {
        this.allProducts = res.rankedProducts;
        this.followUpQuestions = res.followUpQuestions ?? [];
        this.followUpError = null;
        this.primeFollowUpAnswers();
        this.applyRanking();
        this.persistRecommendationContext();
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.warn("Could not fetch recommendations from backend", err);
        this.error = "Could not load recommendations. Please ensure the backend is running.";
        this.loading = false;
        this.allProducts = [
          {
            code: "ENDOWMENT",
            name: "Endowment",
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
            category: "Life Insurance",
            subCategory: "Protection Plans",
          },
        ];
        this.followUpQuestions = [];
        this.applyRanking();
        this.persistRecommendationContext();
        this.cd.detectChanges();
      },
    });
  }

  private applyRanking(): void {
    this.rankedProducts = [...this.allProducts].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.monthlyPremiumEstimate ?? 0) - (b.monthlyPremiumEstimate ?? 0);
    });
  }

  get topRecommendations(): RankedProduct[] {
    return this.rankedProducts.slice(0, 3);
  }

  get shouldAskFollowUps(): boolean {
    return this.followUpQuestions.length > 0;
  }

  submitFollowUps(): void {
    const sessionId = this.customerApi.getStoredSessionId();
    if (!sessionId) {
      this.followUpError = "Session not found. Please restart the wizard.";
      return;
    }

    const missingRequired = this.followUpQuestions.some((q) => {
      if (!q.required) return false;
      const value = this.followUpAnswers[q.key];
      if (q.type === "boolean") return typeof value !== "boolean";
      if (q.type === "number") return value === null || value === undefined || String(value).trim() === "";
      return !value || String(value).trim() === "";
    });
    if (missingRequired) {
      this.followUpError = "Please answer all required additional questions.";
      return;
    }

    const payload = this.normalizedFollowUpPayload();
    this.submittingFollowUps = true;
    this.followUpError = null;
    this.customerApi.submitAnswers(sessionId, payload).subscribe({
      next: () => {
        this.wizard.setRecommendationContext({
          generatedAt: new Date().toISOString(),
          followUpAnswers: {
            ...(this.wizard.snapshot.recommendationContext?.followUpAnswers ?? {}),
            ...payload,
          },
          followUpAskedCount: this.followUpQuestions.length,
        });
        this.loadRecommendations(sessionId);
        this.submittingFollowUps = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.warn("Could not save follow-up answers", err);
        this.followUpError = "Could not submit additional answers. Please try again.";
        this.submittingFollowUps = false;
        this.cd.detectChanges();
      },
    });
  }

  private normalizedFollowUpPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const q of this.followUpQuestions) {
      const raw = this.followUpAnswers[q.key];
      if (raw === undefined || raw === null || raw === "") continue;
      if (q.type === "number") {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) payload[q.key] = parsed;
      } else if (q.type === "boolean") {
        payload[q.key] = !!raw;
      } else {
        payload[q.key] = String(raw).trim();
      }
    }
    return payload;
  }

  private primeFollowUpAnswers(): void {
    for (const q of this.followUpQuestions) {
      if (this.followUpAnswers[q.key] !== undefined) continue;
      if (q.type === "boolean") this.followUpAnswers[q.key] = false;
      else this.followUpAnswers[q.key] = "";
    }
  }

  toggleExpanded(productCode: string): void {
    if (this.expandedCards.has(productCode)) {
      this.expandedCards.delete(productCode);
    } else {
      this.expandedCards.add(productCode);
    }
  }

  isExpanded(productCode: string): boolean {
    return this.expandedCards.has(productCode);
  }

  get inferredCategory(): string {
    const top = this.topRecommendations[0];
    return top?.category || top?.productMetadata?.category || top?.policyType || "Life Insurance";
  }

  get inferredSubcategory(): string {
    const top = this.topRecommendations[0];
    return top?.subCategory || top?.productMetadata?.subCategory || "Protection Plans";
  }

  private persistRecommendationContext(): void {
    this.wizard.setRecommendationContext({
      generatedAt: new Date().toISOString(),
      inferredCategory: this.inferredCategory,
      inferredSubcategory: this.inferredSubcategory,
      topPlanCodes: this.topRecommendations.map((p) => p.code),
      followUpAskedCount: this.followUpQuestions.length,
    });
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
