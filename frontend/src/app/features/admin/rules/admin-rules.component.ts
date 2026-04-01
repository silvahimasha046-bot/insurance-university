import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  errorMsg: string | null = null;

  newRule = { name: '', ruleJson: '{}', version: 1 };
  newPricing = { name: '', pricingJson: '{}', version: 1 };
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  pendingDelete: { type: 'rule' | 'pricing'; id: number } | null = null;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRules();
    this.loadPricing();
  }

  loadRules(): void {
    this.api.listRules().subscribe({
      next: (r) => {
        this.rules = r;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load rules.');
        this.cd.detectChanges();
      },
    });
  }
  showError(message: string): void {
    this.errorMsg = message;
    setTimeout(() => (this.errorMsg = null), 5000);
  }

  createRule(): void {
    this.api.createRule(this.newRule).subscribe({
      next: () => {
        this.newRule = { name: '', ruleJson: '{}', version: 1 };
        this.cd.detectChanges();
        this.loadRules();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  requestDeleteRule(id: number): void {
    if (!id) return;
    this.pendingDelete = { type: 'rule', id };
    this.confirmTitle = 'Delete rule?';
    this.confirmMessage = 'This rule version will be permanently removed.';
    this.confirmOpen = true;
  }

  deleteRule(id: number): void {
    this.api.deleteRule(id).subscribe({
      next: () => {
        this.cd.detectChanges();
        this.loadRules();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  loadPricing(): void {
    this.api.listPricingTables().subscribe({
      next: (r) => {
        this.pricingTables = r;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load pricing tables.');
        this.cd.detectChanges();
      },
    });
  }

  createPricing(): void {
    this.api.createPricingTable(this.newPricing).subscribe({
      next: () => {
        this.newPricing = { name: '', pricingJson: '{}', version: 1 };
        this.cd.detectChanges();
        this.loadPricing();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  requestDeletePricing(id: number): void {
    if (!id) return;
    this.pendingDelete = { type: 'pricing', id };
    this.confirmTitle = 'Delete pricing table?';
    this.confirmMessage = 'This pricing version will be permanently removed.';
    this.confirmOpen = true;
  }

  deletePricing(id: number): void {
    this.api.deletePricingTable(id).subscribe({
      next: () => {
        this.cd.detectChanges();
        this.loadPricing();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  cancelDelete(): void {
    this.confirmOpen = false;
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    const { type, id } = this.pendingDelete;
    this.confirmOpen = false;
    this.pendingDelete = null;
    if (type === 'rule') {
      this.deleteRule(id);
      return;
    }
    this.deletePricing(id);
  }
}
