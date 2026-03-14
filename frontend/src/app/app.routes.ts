import { Routes } from "@angular/router";
import { LandingComponent } from "./features/landing/landing.component";
import { wizardProgressGuard } from "./core/guards/wizard-progress.guard";

export const routes: Routes = [
  { path: "", component: LandingComponent },

  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "register",
    loadComponent: () =>
      import("./features/auth/register/register.component").then((m) => m.RegisterComponent),
  },

  {
    path: "wizard/step-1",
    loadComponent: () =>
      import("./features/wizard/step-1/wizard-step-1.component").then(
        (m) => m.WizardStep1Component
      ),
  },
  {
    path: "wizard/step-2",
    canMatch: [wizardProgressGuard("step-2")],
    loadComponent: () =>
      import("./features/wizard/step-2/wizard-step-2.component").then(
        (m) => m.WizardStep2Component
      ),
  },
  {
    path: "wizard/step-3",
    canMatch: [wizardProgressGuard("step-3")],
    loadComponent: () =>
      import("./features/wizard/step-3/wizard-step-3.component").then(
        (m) => m.WizardStep3Component
      ),
  },

  {
    path: "recommendations",
    canMatch: [wizardProgressGuard("step-3")],
    loadComponent: () =>
      import("./features/recommendations/recommendations.component").then(
        (m) => m.RecommendationsComponent
      ),
  },
  {
    path: "recommendations/compare",
    canMatch: [wizardProgressGuard("plan")],
    loadComponent: () =>
      import("./features/recommendations/compare/recommendations-compare.component").then(
        (m) => m.RecommendationsCompareComponent
      ),
  },

  {
    path: "proposal/upload",
    canMatch: [wizardProgressGuard("plan")],
    loadComponent: () =>
      import("./features/proposal/upload/proposal-upload.component").then(
        (m) => m.ProposalUploadComponent
      ),
  },
  {
    path: "proposal/missing",
    canMatch: [wizardProgressGuard("plan")],
    loadComponent: () =>
      import("./features/proposal/missing/proposal-missing.component").then(
        (m) => m.ProposalMissingComponent
      ),
  },
  {
    path: "proposal/summary",
    canMatch: [wizardProgressGuard("plan")],
    loadComponent: () =>
      import("./features/proposal/summary/proposal-summary.component").then(
        (m) => m.ProposalSummaryComponent
      ),
  },

  {
    path: "simulator",
    canMatch: [wizardProgressGuard("step-3")],
    loadComponent: () =>
      import("./features/simulator/premium-simulator.component").then(
        (m) => m.PremiumSimulatorComponent
      ),
  },

  {
    path: "survey",
    loadComponent: () =>
      import("./features/survey/survey.component").then((m) => m.SurveyComponent),
  },

  { path: "**", redirectTo: "" },
];