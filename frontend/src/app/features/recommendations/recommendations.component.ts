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
  isDashboardJourney = false;

  // New: Continuation/dual-path support
  isContinuingSession = false;
  cachedRecommendationAvailable = false;
  showCachedRecommendation = false;
  cachedRecommendationCreatedAt = '';
  recommendationLoadMode: 'cached' | 'fresh' = 'cached';

  constructor(
    private wizard: WizardStateService,
    private router: Router,
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    this.isDashboardJourney = this.wizard.snapshot.recommendationsEntrySource === "dashboard";
    this.isContinuingSession = this.wizard.snapshot.isContinuingSession ?? false;

    if (!this.isDashboardJourney) {
      this.wizard.setRecommendationsEntrySource("wizard");
    }
    this.followUpAnswers = {
      ...(this.wizard.snapshot.recommendationContext?.followUpAnswers ?? {}),
    };
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      // If continuing session, try to load cached recommendation first
      if (this.isContinuingSession) {
        this.tryLoadCachedRecommendation(sessionId);
      } else {
        this.loadRecommendations(sessionId);
      }
      return;
    }

    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
    }
  }

  /** Try to load the latest cached recommendation from the session. */
  private tryLoadCachedRecommendation(sessionId: string): void {
    this.loading = true;
    this.customerApi.getLatestRecommendation(sessionId).subscribe({
      next: (res) => {
        this.allProducts = res.data.rankedProducts;
        this.followUpQuestions = res.data.followUpQuestions ?? [];
        this.cachedRecommendationAvailable = true;
        this.cachedRecommendationCreatedAt = res.createdAt;
        this.showCachedRecommendation = true;
        this.recommendationLoadMode = 'cached';
        this.primeFollowUpAnswers();
        this.applyRanking();
        this.persistRecommendationContext();
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        // No cached recommendation; load fresh instead
        console.warn("No cached recommendation found, generating fresh recommendations", err);
        this.cachedRecommendationAvailable = false;
        this.loadRecommendations(sessionId);
      },
    });
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
        this.recommendationLoadMode = 'fresh';
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

  /** Regenerate fresh recommendations (only for continuation sessions) */
  regenerateRecommendations(): void {
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.showCachedRecommendation = false;
      this.loadRecommendations(sessionId);
    }
  }

  goBack(): void {
    if (this.isDashboardJourney) {
      this.router.navigateByUrl("/customer/dashboard");
      return;
    }
    this.router.navigateByUrl("/wizard/step-3");
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

  benefitTitle(b: Record<string, unknown>): string {
    return String(
      b['name'] ?? b['title'] ?? b['label'] ??
      Object.values(b).find((v) => typeof v === 'string') ??
      'Benefit'
    );
  }

  benefitDescription(b: Record<string, unknown>): string {
    return String(b['description'] ?? b['detail'] ?? b['text'] ?? '');
  }

  humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  public readonly KNOWN_CALC_LABELS: Record<string, string> = {
    age: 'Age (years)',
    term: 'Policy Term (yrs)',
    premiumTerm: 'Premium Paying Term (yrs)',
    sumAssured: 'Sum Assured (LKR)',
    coverageAmount: 'Coverage Amount (LKR)',
    monthlyPremium: 'Monthly Premium (Rs.)',
    annualPremium: 'Annual Premium (Rs.)',
    deathBenefit: 'Death Benefit (LKR)',
    maturityBenefit: 'Maturity Benefit (LKR)',
    cashValue: 'Cash Value (LKR)',
    income: 'Monthly Income (Rs.)',
    notes: 'Notes',
  };

  calcEntries(calc: Record<string, unknown>): { label: string; value: string }[] {
    const SKIP = ['scenario', 'title', 'label', 'description', 'rows'];
    return Object.entries(calc)
      .filter(([k]) => !SKIP.includes(k))
      .filter(([k, v]) => !(Array.isArray(v) && k === 'rows'))
      .flatMap(([k, v]) => this.flattenCalcValue(k, v, 0));
  }

  private flattenCalcValue(key: string, v: unknown, depth: number): { label: string; value: string }[] {
    const label = this.KNOWN_CALC_LABELS[key] ?? this.humanizeKey(key);
    if (v === null || v === undefined) return [];
    if (typeof v === 'number') return [{ label, value: v.toLocaleString('en-US') }];
    if (typeof v === 'boolean') return [{ label, value: v ? 'Yes' : 'No' }];
    if (typeof v === 'string') return v.trim() ? [{ label, value: v }] : [];
    if (Array.isArray(v)) {
      if (v.length === 0) return [];
      if (v.every((item) => typeof item !== 'object' || item === null)) {
        return [{ label, value: v.join(', ') }];
      }
      if (depth < 2) {
        return v.flatMap((item, i) =>
          typeof item === 'object' && item !== null
            ? Object.entries(item as Record<string, unknown>).flatMap(([k2, v2]) =>
                this.flattenCalcValue(k2, v2, depth + 1)
              )
            : [{ label: `${label} ${i + 1}`, value: String(item) }]
        );
      }
    }
    if (typeof v === 'object' && depth < 2) {
      return Object.entries(v as Record<string, unknown>).flatMap(([k2, v2]) =>
        this.flattenCalcValue(k2, v2, depth + 1)
      );
    }
    return [{ label, value: JSON.stringify(v) }];
  }

  scenarioLabel(calc: Record<string, unknown>, idx: number): string {
    return String(
      calc['scenario'] ?? calc['title'] ?? calc['label'] ?? calc['description'] ?? `Scenario ${idx + 1}`
    );
  }

  hasRowsTable(calc: Record<string, unknown>): boolean {
    if (!calc['rows']) return false;
    const rows = calc['rows'];
    return Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null;
  }

  getTableColumns(rows: unknown[]): string[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const firstRow = rows[0];
    if (typeof firstRow !== 'object' || firstRow === null) return [];
    return Object.keys(firstRow as Record<string, unknown>);
  }

  getTableData(rows: unknown[]): Record<string, unknown>[] {
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => typeof row === 'object' && row !== null) as Record<string, unknown>[];
  }

  formatTableValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return value.toLocaleString('en-US');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') return value.trim() || '—';
    return String(value);
  }

  getTableColumnsForCalc(calc: Record<string, unknown>): string[] {
    const rows = calc['rows'];
    return this.getTableColumns(rows as unknown[]);
  }

  getTableDataForCalc(calc: Record<string, unknown>): Record<string, unknown>[] {
    const rows = calc['rows'];
    return this.getTableData(rows as unknown[]);
  }

  objectEntries(obj: Record<string, number> | undefined): { key: string; value: number }[] {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
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
    this.wizard.setCompareEntrySource("recommendations");
    this.router.navigateByUrl("/recommendations/compare");
  }

  goToCompare(): void {
    this.wizard.setCompareEntrySource("recommendations");
    this.router.navigateByUrl("/recommendations/compare");
  }
}
