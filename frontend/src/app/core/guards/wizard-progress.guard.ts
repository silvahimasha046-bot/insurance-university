import { CanMatchFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { WizardStateService } from "../state/wizard-state.service";

function hasStep1(state: WizardStateService) {
  return Boolean(state.snapshot.step1?.needsText?.trim());
}

function hasStep2(state: WizardStateService) {
  const income = state.snapshot.step2?.monthlyIncomeLkr;
  return typeof income === "number" && income > 0;
}

function hasStep3(state: WizardStateService) {
  return Boolean(state.snapshot.step3?.health);
}

function hasSelectedPlan(state: WizardStateService) {
  return Boolean(state.snapshot.selectedPlan?.id);
}

function hasAuthenticatedSession(): boolean {
  return Boolean(
    localStorage.getItem("insurance_auth_token") && localStorage.getItem("insurance_customer_session_id")
  );
}

export const wizardProgressGuard =
  (required: "step-1" | "step-2" | "step-3" | "plan"): CanMatchFn =>
  () => {
    const router = inject(Router);
    const state = inject(WizardStateService);

    const ok =
      required === "step-1"
        ? true
        : required === "step-2"
          ? hasStep1(state)
          : required === "step-3"
            ? hasStep1(state) && hasStep2(state)
            : hasStep1(state) && hasStep2(state) && hasStep3(state) && hasSelectedPlan(state);

    // Post-login journey allows session-driven entry from dashboard.
    if (!ok && (required === "step-3" || required === "plan") && hasAuthenticatedSession()) {
      return true;
    }

    if (ok) return true;

    if (!hasStep1(state)) return router.parseUrl("/wizard/step-1");
    if (!hasStep2(state)) return router.parseUrl("/wizard/step-2");
    if (!hasStep3(state)) return router.parseUrl("/wizard/step-3");
    return router.parseUrl("/recommendations");
  };