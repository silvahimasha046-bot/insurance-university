import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-wizard-step-3",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./wizard-step-3.component.html",
})
export class WizardStep3Component implements OnInit {
  health: "excellent" | "good" | "average" | "poor" = "good";
  tobaccoUse = false;
  conditionsText = "";

  // Binary disease flags (CART gates)
  heartDisease = false;
  cancer = false;
  stroke = false;
  otherOrganIssues = false;
  hospitalization5Yrs = false;
  familyHistory = false;

  // Lifestyle
  hazardousPursuits = false;
  flyingActivity = false;

  isLoggedIn = false;

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step3;
    if (s?.health) this.health = s.health;
    if (typeof s?.tobaccoUse === "boolean") this.tobaccoUse = s.tobaccoUse;
    if (typeof s?.heartDisease === "boolean") this.heartDisease = s.heartDisease;
    if (typeof s?.cancer === "boolean") this.cancer = s.cancer;
    if (typeof s?.stroke === "boolean") this.stroke = s.stroke;
    if (typeof s?.otherOrganIssues === "boolean") this.otherOrganIssues = s.otherOrganIssues;
    if (typeof s?.hospitalization5Yrs === "boolean") this.hospitalization5Yrs = s.hospitalization5Yrs;
    if (typeof s?.familyHistory === "boolean") this.familyHistory = s.familyHistory;
    if (typeof s?.hazardousPursuits === "boolean") this.hazardousPursuits = s.hazardousPursuits;
    if (typeof s?.flyingActivity === "boolean") this.flyingActivity = s.flyingActivity;
    if (s?.conditions) this.conditionsText = s.conditions.join(", ");
  }

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem("insurance_auth_token");
  }

  get hasTraditionalDiseaseFlag(): boolean {
    return this.heartDisease || this.cancer || this.stroke || this.otherOrganIssues;
  }

  get eligibilityWarning(): string | null {
    if (this.hasTraditionalDiseaseFlag) {
      return "One or more traditional disease disclosures will result in a 'No Offer' or referral to manual underwriting.";
    }
    if (this.hospitalization5Yrs) {
      return "Recent hospitalisation or surgery may exclude Critical Illness riders and trigger manual review.";
    }
    if (this.hazardousPursuits || this.flyingActivity) {
      return "Hazardous activity participation will exclude the Accidental Death Benefit rider.";
    }
    return null;
  }

  persist(): void {
    const conditions = this.conditionsText
      ? this.conditionsText.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
    this.wizard.updateStep3({
      health: this.health,
      tobaccoUse: this.tobaccoUse,
      conditions,
      heartDisease: this.heartDisease,
      cancer: this.cancer,
      stroke: this.stroke,
      otherOrganIssues: this.otherOrganIssues,
      hospitalization5Yrs: this.hospitalization5Yrs,
      familyHistory: this.familyHistory,
      hazardousPursuits: this.hazardousPursuits,
      flyingActivity: this.flyingActivity,
    });
  }

  seeRecommendations(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      const conditions = this.conditionsText
        ? this.conditionsText.split(",").map((c) => c.trim()).filter(Boolean)
        : [];
      this.customerApi
        .submitAnswers(sessionId, {
          health: this.health,
          smoker: this.tobaccoUse,
          conditions,
          heartDisease: this.heartDisease,
          cancer: this.cancer,
          stroke: this.stroke,
          otherOrganIssues: this.otherOrganIssues,
          hospitalization5Yrs: this.hospitalization5Yrs,
          familyHistory: this.familyHistory,
          hazardousPursuits: this.hazardousPursuits,
          flyingActivity: this.flyingActivity,
        })
        .subscribe({
          error: (err) => console.warn("Could not save step-3 answers", err),
        });
    }
    this.router.navigateByUrl("/recommendations");
  }
}

