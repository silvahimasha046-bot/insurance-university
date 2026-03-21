import { Routes } from "@angular/router";
import { HomeComponent } from "./features/home/home.component";
import { wizardProgressGuard } from "./core/guards/wizard-progress.guard";
import { adminGuard } from "./core/guards/admin.guard";

export const routes: Routes = [
  { path: "", component: HomeComponent },

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

  {
    path: "admin/login",
    loadComponent: () =>
      import("./features/admin/login/admin-login.component").then((m) => m.AdminLoginComponent),
  },
  {
    path: "admin",
    canMatch: [adminGuard],
    loadComponent: () =>
      import("./features/admin/layout/admin-layout.component").then((m) => m.AdminLayoutComponent),
    children: [
      { path: "", redirectTo: "dashboard", pathMatch: "full" },
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/admin/dashboard/admin-dashboard.component").then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: "products",
        loadComponent: () =>
          import("./features/admin/products/admin-products.component").then(
            (m) => m.AdminProductsComponent
          ),
      },
      {
        path: "rules",
        loadComponent: () =>
          import("./features/admin/rules/admin-rules.component").then(
            (m) => m.AdminRulesComponent
          ),
      },
      {
        path: "training",
        loadComponent: () =>
          import("./features/admin/training/admin-training.component").then(
            (m) => m.AdminTrainingComponent
          ),
      },
      {
        path: "logs",
        loadComponent: () =>
          import("./features/admin/logs/admin-logs.component").then(
            (m) => m.AdminLogsComponent
          ),
      },
      {
        path: "insights",
        loadComponent: () =>
          import("./features/admin/insights/admin-insights.component").then(
            (m) => m.AdminInsightsComponent
          ),
      },
    ],
  },

  { path: "**", redirectTo: "" },
];
