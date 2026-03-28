import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-wizard-step-2",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./wizard-step-2.component.html",
})
export class WizardStep2Component implements OnInit {
  age = 30;
  monthlyIncomeLkr = 75000;
  monthlyExpensesLkr = 35000;
  netWorthLkr = 0;
  liquidNetWorthLkr = 0;
  targetPremiumRange = "5000-10000";
  premiumPaymentYears = "AllYears";
  preferredPaymentMode: "Monthly" | "Quarterly" | "HalfYearly" | "Yearly" | "Single" = "Monthly";
  loansText = "";

  memberCount = 0;
  childrenAges = "";
  protectionPurpose: "SurvivorIncome" | "EducationFunding" | "RetirementSupplement" | "EstateLiquidity" = "SurvivorIncome";
  desiredPolicyTermYears = 20;
  desiredSumAssured = 10000000;

  prioritySafety = 3;
  priorityFlexibility = 3;
  priorityEquity = 3;
  priorityCertainty = 3;
  priorityPremiumLevel = 3;

  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step2;
    if (typeof s?.age === "number") this.age = s.age;
    if (typeof s?.monthlyIncomeLkr === "number") this.monthlyIncomeLkr = s.monthlyIncomeLkr;
    if (typeof s?.monthlyExpensesLkr === "number") this.monthlyExpensesLkr = s.monthlyExpensesLkr;
    if (typeof s?.netWorthLkr === "number") this.netWorthLkr = s.netWorthLkr;
    if (typeof s?.liquidNetWorthLkr === "number") this.liquidNetWorthLkr = s.liquidNetWorthLkr;
    if (typeof s?.targetPremiumRange === "string") this.targetPremiumRange = s.targetPremiumRange;
    if (typeof s?.premiumPaymentYears === "string") this.premiumPaymentYears = s.premiumPaymentYears;
    if (s?.preferredPaymentMode) this.preferredPaymentMode = s.preferredPaymentMode;
    if (typeof s?.loansText === "string") this.loansText = s.loansText;
    if (typeof s?.memberCount === "number") this.memberCount = s.memberCount;
    if (typeof s?.childrenAges === "string") this.childrenAges = s.childrenAges;
    if (s?.protectionPurpose) this.protectionPurpose = s.protectionPurpose;
    if (typeof s?.desiredPolicyTermYears === "number") this.desiredPolicyTermYears = s.desiredPolicyTermYears;
    if (typeof s?.desiredSumAssured === "number") this.desiredSumAssured = s.desiredSumAssured;
    if (typeof s?.prioritySafety === "number") this.prioritySafety = s.prioritySafety;
    if (typeof s?.priorityFlexibility === "number") this.priorityFlexibility = s.priorityFlexibility;
    if (typeof s?.priorityEquity === "number") this.priorityEquity = s.priorityEquity;
    if (typeof s?.priorityCertainty === "number") this.priorityCertainty = s.priorityCertainty;
    if (typeof s?.priorityPremiumLevel === "number") this.priorityPremiumLevel = s.priorityPremiumLevel;
  }

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem("insurance_auth_token");
  }

  get disposableIncome(): number {
    return Math.max(0, this.monthlyIncomeLkr - this.monthlyExpensesLkr);
  }

  get recommendedCoverageLkr(): number {
    return Math.max(10_000_000, Math.round(this.monthlyExpensesLkr * 12 * 10));
  }

  persist() {
    this.wizard.updateStep2({
      age: this.age,
      monthlyIncomeLkr: this.monthlyIncomeLkr,
      monthlyExpensesLkr: this.monthlyExpensesLkr,
      netWorthLkr: this.netWorthLkr,
      liquidNetWorthLkr: this.liquidNetWorthLkr,
      targetPremiumRange: this.targetPremiumRange,
      premiumPaymentYears: this.premiumPaymentYears,
      preferredPaymentMode: this.preferredPaymentMode,
      loansText: this.loansText,
      recommendedCoverageLkr: this.recommendedCoverageLkr,
      memberCount: this.memberCount,
      childrenAges: this.childrenAges,
      protectionPurpose: this.protectionPurpose,
      desiredPolicyTermYears: this.desiredPolicyTermYears,
      desiredSumAssured: this.desiredSumAssured,
      prioritySafety: this.prioritySafety,
      priorityFlexibility: this.priorityFlexibility,
      priorityEquity: this.priorityEquity,
      priorityCertainty: this.priorityCertainty,
      priorityPremiumLevel: this.priorityPremiumLevel,
    });
  }

  getPriorityValue(model: string): number {
    switch (model) {
      case "prioritySafety": return this.prioritySafety;
      case "priorityFlexibility": return this.priorityFlexibility;
      case "priorityEquity": return this.priorityEquity;
      case "priorityCertainty": return this.priorityCertainty;
      default: return this.priorityPremiumLevel;
    }
  }

  setPriorityValue(model: string, value: number): void {
    switch (model) {
      case "prioritySafety": this.prioritySafety = value; break;
      case "priorityFlexibility": this.priorityFlexibility = value; break;
      case "priorityEquity": this.priorityEquity = value; break;
      case "priorityCertainty": this.priorityCertainty = value; break;
      default: this.priorityPremiumLevel = value; break;
    }
    this.persist();
  }

  next(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi
        .submitAnswers(sessionId, {
          age: this.age,
          monthlyIncomeLkr: this.monthlyIncomeLkr,
          monthlyExpensesLkr: this.monthlyExpensesLkr,
          netWorthLkr: this.netWorthLkr,
          liquidNetWorthLkr: this.liquidNetWorthLkr,
          targetPremiumRange: this.targetPremiumRange,
          premiumPaymentYears: this.premiumPaymentYears,
          preferredPaymentMode: this.preferredPaymentMode,
          loansText: this.loansText,
          memberCount: this.memberCount,
          childrenAges: this.childrenAges,
          protectionPurpose: this.protectionPurpose,
          desiredPolicyTermYears: this.desiredPolicyTermYears,
          desiredSumAssured: this.desiredSumAssured,
          prioritySafety: this.prioritySafety,
          priorityFlexibility: this.priorityFlexibility,
          priorityEquity: this.priorityEquity,
          priorityCertainty: this.priorityCertainty,
          priorityPremiumLevel: this.priorityPremiumLevel,
        })
        .subscribe({
          error: (err) => console.warn("Could not save step-2 answers", err),
        });
    }
    this.router.navigateByUrl("/wizard/step-3");
  }
}
