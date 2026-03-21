import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";

const DISTRICTS = [
  'Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya',
  'Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar',
  'Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee',
  'Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla',
  'Monaragala','Ratnapura','Kegalle',
];

@Component({
  selector: "app-proposal-missing",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./proposal-missing.component.html",
})
export class ProposalMissingComponent implements OnInit {
  districts = DISTRICTS;

  addressLine1 = '';
  city = '';
  district = '';
  nicNumber = '';

  selectedPlan = this.wizard.snapshot.selectedPlan;

  constructor(private wizard: WizardStateService, private router: Router) {}

  ngOnInit(): void {
    const mf = this.wizard.snapshot.missingFields;
    if (mf) {
      this.addressLine1 = mf.addressLine1 ?? '';
      this.city        = mf.city        ?? '';
      this.district    = mf.district    ?? '';
      this.nicNumber   = mf.nicNumber   ?? '';
    }
  }

  generate(): void {
    this.wizard.updateMissingFields({
      addressLine1: this.addressLine1,
      city:         this.city,
      district:     this.district,
      nicNumber:    this.nicNumber,
    });
    this.router.navigateByUrl('/proposal/summary');
  }
}