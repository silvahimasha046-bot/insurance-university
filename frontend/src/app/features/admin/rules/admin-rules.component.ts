import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-rules.component.html',
})
export class AdminRulesComponent implements OnInit {
  rules: any[] = [];
  pricingTables: any[] = [];

  newRule = { name: '', ruleJson: '{}', version: 1 };
  newPricing = { name: '', pricingJson: '{}', version: 1 };

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadRules();
    this.loadPricing();
  }

  loadRules(): void {
    this.api.listRules().subscribe(r => (this.rules = r));
  }

  createRule(): void {
    this.api.createRule(this.newRule).subscribe(() => {
      this.newRule = { name: '', ruleJson: '{}', version: 1 };
      this.loadRules();
    });
  }

  deleteRule(id: number): void {
    this.api.deleteRule(id).subscribe(() => this.loadRules());
  }

  loadPricing(): void {
    this.api.listPricingTables().subscribe(p => (this.pricingTables = p));
  }

  createPricing(): void {
    this.api.createPricingTable(this.newPricing).subscribe(() => {
      this.newPricing = { name: '', pricingJson: '{}', version: 1 };
      this.loadPricing();
    });
  }

  deletePricing(id: number): void {
    this.api.deletePricingTable(id).subscribe(() => this.loadPricing());
  }
}
