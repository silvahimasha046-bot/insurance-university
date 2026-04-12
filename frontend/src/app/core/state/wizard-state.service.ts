import { Injectable } from "@angular/core";

export type WizardStep =
  | "step-1"
  | "step-2"
  | "step-3"
  | "recommendations"
  | "compare"
  | "upload"
  | "missing"
  | "summary";

export interface WizardState {
  version: number;
  updatedAt: string;

  step1?: {
    needsText?: string;
    isPep?: boolean;
    hasCriminalHistory?: boolean;
    educationLevel?: "Postgrad" | "Undergrad" | "College" | "HighSchool" | "Elementary";
    occupation?: string;
    occupationHazardLevel?: number;
  };

  step2?: {
    age?: number;
    monthlyIncomeLkr?: number;
    monthlyExpensesLkr?: number;
    netWorthLkr?: number;
    liquidNetWorthLkr?: number;
    targetPremiumRange?: string;
    premiumPaymentYears?: string;
    loansText?: string;
    recommendedCoverageLkr?: number;
    memberCount?: number;
    childrenAges?: string;
    protectionPurpose?: "SurvivorIncome" | "EducationFunding" | "RetirementSupplement" | "EstateLiquidity";
    desiredPolicyTermYears?: number;
    desiredSumAssured?: number;
    preferredPaymentMode?: "Monthly" | "Quarterly" | "HalfYearly" | "Yearly" | "Single";
    prioritySafety?: number;
    priorityFlexibility?: number;
    priorityEquity?: number;
    priorityCertainty?: number;
    priorityPremiumLevel?: number;
  };

  step3?: {
    health?: "excellent" | "good" | "average" | "poor";
    tobaccoUse?: boolean;
    conditions?: string[];
    heartDisease?: boolean;
    cancer?: boolean;
    stroke?: boolean;
    otherOrganIssues?: boolean;
    hospitalization5Yrs?: boolean;
    familyHistory?: boolean;
    hazardousPursuits?: boolean;
    flyingActivity?: boolean;
  };

  selectedPlan?: {
    id: string;
    name: string;
    premiumLkrPerMonth: number;
    matchPercent: number;
    eligibilityDecision?: string;
    predictedCoverage?: number;
    policyType?: string;
    riderExclusions?: string[];
    reasons?: string[];
  };

  recommendationContext?: {
    generatedAt?: string;
    inferredCategory?: string;
    inferredSubcategory?: string;
    topPlanCodes?: string[];
    followUpAnswers?: Record<string, unknown>;
    followUpAskedCount?: number;
  };

  recommendationsEntrySource?: "dashboard" | "wizard";
  simulatorEntrySource?: "dashboard" | "wizard";
  compareEntrySource?: "dashboard" | "recommendations";
  uploadEntrySource?: "dashboard";

  documents?: {
    nicUploaded?: boolean;
    medicalUploaded?: boolean;
    incomeUploaded?: boolean;
  };

  missingFields?: {
    addressLine1?: string;
    city?: string;
    district?: string;
    nicNumber?: string;
  };
}

const STORAGE_KEY = "insurance_university_wizard_state_v3";

@Injectable({ providedIn: "root" })
export class WizardStateService {
  private state: WizardState = this.load();

  get snapshot(): WizardState {
    return this.state;
  }

  setPartial(patch: Partial<WizardState>) {
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  updateStep1(patch: WizardState["step1"]) {
    this.setPartial({ step1: { ...(this.state.step1 ?? {}), ...(patch ?? {}) } });
  }

  updateStep2(patch: WizardState["step2"]) {
    this.setPartial({ step2: { ...(this.state.step2 ?? {}), ...(patch ?? {}) } });
  }

  updateStep3(patch: WizardState["step3"]) {
    this.setPartial({ step3: { ...(this.state.step3 ?? {}), ...(patch ?? {}) } });
  }

  updateMissingFields(patch: WizardState["missingFields"]) {
    this.setPartial({
      missingFields: { ...(this.state.missingFields ?? {}), ...(patch ?? {}) },
    });
  }

  setSelectedPlan(plan: WizardState["selectedPlan"]) {
    this.setPartial({ selectedPlan: plan ?? undefined });
  }

  setRecommendationContext(patch: WizardState["recommendationContext"]) {
    this.setPartial({
      recommendationContext: {
        ...(this.state.recommendationContext ?? {}),
        ...(patch ?? {}),
      },
    });
  }

  setRecommendationsEntrySource(source?: "dashboard" | "wizard") {
    this.setPartial({ recommendationsEntrySource: source });
  }

  setSimulatorEntrySource(source?: "dashboard" | "wizard") {
    this.setPartial({ simulatorEntrySource: source });
  }

  setCompareEntrySource(source?: "dashboard" | "recommendations") {
    this.setPartial({ compareEntrySource: source });
  }

  setUploadEntrySource(source?: "dashboard") {
    this.setPartial({ uploadEntrySource: source });
  }

  setDocuments(patch: WizardState["documents"]) {
    this.setPartial({
      documents: { ...(this.state.documents ?? {}), ...(patch ?? {}) },
    });
  }

  clear() {
    this.state = this.defaultState();
    localStorage.removeItem(STORAGE_KEY);
  }

  private defaultState(): WizardState {
    return {
      version: 3,
      updatedAt: new Date().toISOString(),
    };
  }

  private load(): WizardState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw) as WizardState;

      if (!parsed || parsed.version !== 3) return this.defaultState();
      return { ...this.defaultState(), ...parsed };
    } catch {
      return this.defaultState();
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}