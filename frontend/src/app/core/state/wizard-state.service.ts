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
  };

  step2?: {
    monthlyIncomeLkr?: number;
    loansText?: string;
    recommendedCoverageLkr?: number;
  };

  step3?: {
    health?: "excellent" | "good" | "average" | "poor";
    tobaccoUse?: boolean;
    conditions?: string[];
  };

  selectedPlan?: {
    id: string;
    name: string;
    premiumLkrPerMonth: number;
    matchPercent: number;
  };

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

const STORAGE_KEY = "insurance_university_wizard_state_v1";

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
      version: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  private load(): WizardState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw) as WizardState;

      if (!parsed || parsed.version !== 1) return this.defaultState();
      return { ...this.defaultState(), ...parsed };
    } catch {
      return this.defaultState();
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}