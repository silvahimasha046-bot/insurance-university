import { Injectable } from "@angular/core";
import { CustomerApiService } from "../customer-api.service";
import { firstValueFrom } from "rxjs";

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
  continuationSessionId?: string;
  isContinuingSession?: boolean;

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
    nicFrontUploaded?: boolean;
    nicBackUploaded?: boolean;
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

  constructor(private customerApi: CustomerApiService) {}

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

  /** Load a previous session's answers and populate the wizard state. */
  async loadSessionForContinuation(sessionId: string): Promise<void> {
    try {
      const answers = await firstValueFrom(this.customerApi.getSessionAnswers(sessionId));
      
      // Map flat answers to step structures
      const step1: WizardState["step1"] = {};
      const step2: WizardState["step2"] = {};
      const step3: WizardState["step3"] = {};

      // Step 1 mapping
      if (answers["needsText"]) step1.needsText = String(answers["needsText"]);
      if (answers["isPep"] !== undefined) step1.isPep = Boolean(answers["isPep"]);
      if (answers["hasCriminalHistory"] !== undefined) step1.hasCriminalHistory = Boolean(answers["hasCriminalHistory"]);
      if (answers["educationLevel"]) step1.educationLevel = String(answers["educationLevel"]) as any;
      if (answers["occupation"]) step1.occupation = String(answers["occupation"]);
      if (answers["occupationHazardLevel"]) step1.occupationHazardLevel = Number(answers["occupationHazardLevel"]);

      // Step 2 mapping
      if (answers["age"]) step2.age = Number(answers["age"]);
      if (answers["monthlyIncomeLkr"]) step2.monthlyIncomeLkr = Number(answers["monthlyIncomeLkr"]);
      if (answers["monthlyExpensesLkr"]) step2.monthlyExpensesLkr = Number(answers["monthlyExpensesLkr"]);
      if (answers["netWorthLkr"]) step2.netWorthLkr = Number(answers["netWorthLkr"]);
      if (answers["liquidNetWorthLkr"]) step2.liquidNetWorthLkr = Number(answers["liquidNetWorthLkr"]);
      if (answers["targetPremiumRange"]) step2.targetPremiumRange = String(answers["targetPremiumRange"]);
      if (answers["premiumPaymentYears"]) step2.premiumPaymentYears = String(answers["premiumPaymentYears"]);
      if (answers["preferredPaymentMode"]) step2.preferredPaymentMode = String(answers["preferredPaymentMode"]) as any;
      if (answers["loansText"]) step2.loansText = String(answers["loansText"]);
      if (answers["memberCount"]) step2.memberCount = Number(answers["memberCount"]);
      if (answers["childrenAges"]) step2.childrenAges = String(answers["childrenAges"]);
      if (answers["protectionPurpose"]) step2.protectionPurpose = String(answers["protectionPurpose"]) as any;
      if (answers["desiredPolicyTermYears"]) step2.desiredPolicyTermYears = Number(answers["desiredPolicyTermYears"]);
      if (answers["desiredSumAssured"]) step2.desiredSumAssured = Number(answers["desiredSumAssured"]);
      if (answers["prioritySafety"]) step2.prioritySafety = Number(answers["prioritySafety"]);
      if (answers["priorityFlexibility"]) step2.priorityFlexibility = Number(answers["priorityFlexibility"]);
      if (answers["priorityEquity"]) step2.priorityEquity = Number(answers["priorityEquity"]);
      if (answers["priorityCertainty"]) step2.priorityCertainty = Number(answers["priorityCertainty"]);
      if (answers["priorityPremiumLevel"]) step2.priorityPremiumLevel = Number(answers["priorityPremiumLevel"]);

      // Step 3 mapping
      if (answers["health"]) step3.health = String(answers["health"]) as any;
      if (answers["tobaccoUse"] !== undefined) step3.tobaccoUse = Boolean(answers["tobaccoUse"]);
      if (Array.isArray(answers["conditions"])) step3.conditions = answers["conditions"] as string[];
      if (answers["heartDisease"] !== undefined) step3.heartDisease = Boolean(answers["heartDisease"]);
      if (answers["cancer"] !== undefined) step3.cancer = Boolean(answers["cancer"]);
      if (answers["stroke"] !== undefined) step3.stroke = Boolean(answers["stroke"]);
      if (answers["otherOrganIssues"] !== undefined) step3.otherOrganIssues = Boolean(answers["otherOrganIssues"]);
      if (answers["hospitalization5Yrs"] !== undefined) step3.hospitalization5Yrs = Boolean(answers["hospitalization5Yrs"]);
      if (answers["familyHistory"] !== undefined) step3.familyHistory = Boolean(answers["familyHistory"]);
      if (answers["hazardousPursuits"] !== undefined) step3.hazardousPursuits = Boolean(answers["hazardousPursuits"]);
      if (answers["flyingActivity"] !== undefined) step3.flyingActivity = Boolean(answers["flyingActivity"]);

      // Update state with loaded data
      this.setPartial({
        continuationSessionId: sessionId,
        isContinuingSession: true,
        step1: { ...(this.state.step1 ?? {}), ...step1 },
        step2: { ...(this.state.step2 ?? {}), ...step2 },
        step3: { ...(this.state.step3 ?? {}), ...step3 },
      });
    } catch (error) {
      console.error("Failed to load session for continuation:", error);
      throw error;
    }
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