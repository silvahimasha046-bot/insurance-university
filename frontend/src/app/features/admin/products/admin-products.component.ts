import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  AdminCategory,
  AdminProduct,
  AdminSubcategory,
} from '../admin-api.service';

interface TagOption { value: string; label: string; }

const COMMON_TAGS: TagOption[] = [
  { value: 'life', label: 'Life' },
  { value: 'protection', label: 'Protection' },
  { value: 'endowment', label: 'Endowment' },
  { value: 'advanced-payment', label: 'Advanced Payment' },
  { value: 'smart', label: 'Smart Protection' },
  { value: 'supreme', label: 'Supreme' },
  { value: 'saubhagya', label: 'Saubhagya' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'investment', label: 'Investment' },
  { value: 'critical', label: 'Critical Illness' },
  { value: 'health', label: 'Health' },
  { value: 'medical', label: 'Medical' },
];

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent implements OnInit {
  products: AdminProduct[] = [];
  categories: AdminCategory[] = [];
  subcategories: AdminSubcategory[] = [];
  visibleSubcategories: AdminSubcategory[] = [];

  editId: number | null = null;
  form = {
    code: '',
    name: '',
    basePremium: 0,
    categoryId: null as number | null,
    subcategoryId: null as number | null,
    howItWorksText: '',
    benefitsJson: '',
    ridersJson: '',
    eligibilityJson: '',
    sampleCalculationsJson: '',
    paymentModesJson: '',
    additionalBenefitsText: '',
    minEligibleAge: null as number | null,
    maxEligibleAge: null as number | null,
    minPolicyTermYears: null as number | null,
    maxPolicyTermYears: null as number | null,
  };

  commonTags: TagOption[] = COMMON_TAGS;
  selectedTags = new Set<string>();
  customTagInput = '';

  successMsg: string | null = null;
  errorMsg: string | null = null;
  confirmDeleteOpen = false;
  deleteCandidateId: number | null = null;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadHierarchy();
    this.loadProducts();
  }

  loadHierarchy(): void {
    this.api.listCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.refreshVisibleSubcategories();
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load categories.');
        this.cd.detectChanges();
      },
    });

    this.api.listSubcategories().subscribe({
      next: (subcategories) => {
        this.subcategories = subcategories;
        this.refreshVisibleSubcategories();
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load subcategories.');
        this.cd.detectChanges();
      },
    });
  }

  loadProducts(): void {
    this.api.listProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load products.');
        this.cd.detectChanges();
      },
    });
  }

  onCategoryChange(categoryId: number | null): void {
    this.form.categoryId = categoryId;
    this.form.subcategoryId = null;
    this.refreshVisibleSubcategories();
  }

  refreshVisibleSubcategories(): void {
    if (!this.form.categoryId) {
      this.visibleSubcategories = [];
      return;
    }
    this.visibleSubcategories = this.subcategories.filter(
      (s) => s.category?.id === this.form.categoryId
    );
  }

  get selectedTagsArray(): string[] {
    return Array.from(this.selectedTags);
  }

  toggleTag(value: string): void {
    if (this.selectedTags.has(value)) this.selectedTags.delete(value);
    else this.selectedTags.add(value);
  }

  removeTag(value: string): void {
    this.selectedTags.delete(value);
  }

  addCustomTag(): void {
    const tag = this.customTagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (tag) {
      this.selectedTags.add(tag);
      this.customTagInput = '';
    }
  }

  parseTags(tagsJson: string | undefined): string[] {
    if (!tagsJson) return [];
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(): void {
    if (!this.form.code.trim() || !this.form.name.trim() || Number(this.form.basePremium) <= 0) {
      this.showError('Please enter plan code, plan name, and base premium.');
      return;
    }

    if (!this.form.categoryId) {
      this.showError('Please select a main category.');
      return;
    }

    const category = this.categories.find((c) => c.id === this.form.categoryId) || null;
    const subcategory = this.subcategories.find((s) => s.id === this.form.subcategoryId) || null;

    const body: AdminProduct = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      basePremium: Number(this.form.basePremium),
      tagsJson: JSON.stringify(this.selectedTagsArray),
      category: category ? { id: category.id, code: category.code, name: category.name } : null,
      subcategory: subcategory
        ? {
            id: subcategory.id,
            code: subcategory.code,
            name: subcategory.name,
            category: subcategory.category,
          }
        : null,
      howItWorksText: this.form.howItWorksText?.trim() || undefined,
      benefitsJson: this.cleanJsonText(this.form.benefitsJson),
      ridersJson: this.cleanJsonText(this.form.ridersJson),
      eligibilityJson: this.cleanJsonText(this.form.eligibilityJson),
      sampleCalculationsJson: this.cleanJsonText(this.form.sampleCalculationsJson),
      paymentModesJson: this.cleanJsonText(this.form.paymentModesJson),
      additionalBenefitsText: this.form.additionalBenefitsText?.trim() || undefined,
      minEligibleAge: this.form.minEligibleAge,
      maxEligibleAge: this.form.maxEligibleAge,
      minPolicyTermYears: this.form.minPolicyTermYears,
      maxPolicyTermYears: this.form.maxPolicyTermYears,
    };

    if (this.editId) {
      this.api.updateProduct(this.editId, body).subscribe({
        next: (updated) => {
          const normalized = this.normalizeSavedProduct(updated || body);
          this.products = this.products.map((p) =>
            p.id === this.editId ? { ...p, ...normalized } : p
          );
          this.showSuccess('Plan updated.');
          this.cancelEdit();
          this.cd.detectChanges();
        },
        error: () => {
          this.showError('Failed to update plan. Check hierarchy and JSON fields.');
          this.cd.detectChanges();
        },
      });
    } else {
      this.api.createProduct(body).subscribe({
        next: (created) => {
          const normalized = this.normalizeSavedProduct(created || body);
          this.products = [normalized, ...this.products];
          this.showSuccess('Plan created.');
          this.resetForm();
          this.cd.detectChanges();
        },
        error: () => {
          this.showError('Failed to create plan. Check code uniqueness and hierarchy.');
          this.cd.detectChanges();
        },
      });
    }
  }

  edit(p: AdminProduct): void {
    this.editId = p.id || null;
    this.form = {
      code: p.code,
      name: p.name,
      basePremium: p.basePremium,
      categoryId: p.category?.id ?? null,
      subcategoryId: p.subcategory?.id ?? null,
      howItWorksText: p.howItWorksText ?? '',
      benefitsJson: p.benefitsJson ?? '',
      ridersJson: p.ridersJson ?? '',
      eligibilityJson: p.eligibilityJson ?? '',
      sampleCalculationsJson: p.sampleCalculationsJson ?? '',
      paymentModesJson: p.paymentModesJson ?? '',
      additionalBenefitsText: p.additionalBenefitsText ?? '',
      minEligibleAge: p.minEligibleAge ?? null,
      maxEligibleAge: p.maxEligibleAge ?? null,
      minPolicyTermYears: p.minPolicyTermYears ?? null,
      maxPolicyTermYears: p.maxPolicyTermYears ?? null,
    };
    this.selectedTags = new Set(this.parseTags(p.tagsJson));
    this.refreshVisibleSubcategories();
  }

  cancelEdit(): void {
    this.editId = null;
    this.resetForm();
  }

  remove(id: number): void {
    if (!id) return;
    this.deleteCandidateId = id;
    this.confirmDeleteOpen = true;
  }

  cancelDelete(): void {
    this.confirmDeleteOpen = false;
    this.deleteCandidateId = null;
  }

  confirmDelete(): void {
    const id = this.deleteCandidateId;
    if (!id) return;
    this.confirmDeleteOpen = false;
    this.deleteCandidateId = null;

    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.showSuccess('Plan deleted.');
        this.cd.detectChanges();
        this.loadProducts();
      },
      error: () => {
        this.showError('Failed to delete plan.');
        this.cd.detectChanges();
      },
    });
  }

  private resetForm(): void {
    this.form = {
      code: '',
      name: '',
      basePremium: 0,
      categoryId: null,
      subcategoryId: null,
      howItWorksText: '',
      benefitsJson: '',
      ridersJson: '',
      eligibilityJson: '',
      sampleCalculationsJson: '',
      paymentModesJson: '',
      additionalBenefitsText: '',
      minEligibleAge: null,
      maxEligibleAge: null,
      minPolicyTermYears: null,
      maxPolicyTermYears: null,
    };
    this.selectedTags = new Set();
    this.customTagInput = '';
    this.refreshVisibleSubcategories();
  }

  private cleanJsonText(value: string): string | undefined {
    const text = value?.trim();
    return text ? text : undefined;
  }

  private normalizeSavedProduct(product: AdminProduct): AdminProduct {
    const category =
      product.category ||
      this.categories.find((c) => c.id === this.form.categoryId) ||
      null;
    const subcategory =
      product.subcategory ||
      this.subcategories.find((s) => s.id === this.form.subcategoryId) ||
      null;

    return {
      ...product,
      category,
      subcategory,
    };
  }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = null;
    setTimeout(() => (this.successMsg = null), 4000);
  }

  private showError(msg: string): void {
    this.errorMsg = msg;
    this.successMsg = null;
    setTimeout(() => (this.errorMsg = null), 6000);
  }
}
