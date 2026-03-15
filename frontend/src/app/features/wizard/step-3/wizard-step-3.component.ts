import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";

@Component({
  selector: "app-wizard-step-3",
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: "./wizard-step-3.component.html",
})
export class WizardStep3Component {
  health: "excellent" | "good" | "average" | "poor" = "good";
  tobaccoUse = false;
  conditionsText = "";

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private router: Router
  ) {
    const s = this.wizard.snapshot.step3;
    if (s?.health) this.health = s.health;
    if (typeof s?.tobaccoUse === "boolean") this.tobaccoUse = s.tobaccoUse;
  }

  persist(): void {
    const conditions = this.conditionsText
      ? this.conditionsText.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
    this.wizard.updateStep3({ health: this.health, tobaccoUse: this.tobaccoUse, conditions });
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
        })
        .subscribe({
          error: (err) => console.warn("Could not save step-3 answers", err),
        });
    }
    this.router.navigateByUrl("/recommendations");
  }
}
