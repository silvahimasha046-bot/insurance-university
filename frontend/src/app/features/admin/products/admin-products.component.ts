import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

interface TagOption { value: string; label: string; }

const COMMON_TAGS: TagOption[] = [
  { value: 'life',       label: 'Life' },
  { value: 'term',       label: 'Term' },
  { value: 'family',     label: 'Family' },
  { value: 'whole',      label: 'Whole Life' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'investment', label: 'Investment' },
  { value: 'invest',     label: 'Invest (ULIP)' },
  { value: 'critical',   label: 'Critical Illness' },
  { value: 'ci',         label: 'CI Rider' },
  { value: 'health',     label: 'Health' },
  { value: 'medical',    label: 'Medical' },
  { value: 'senior',     label: 'Senior Care' },
];

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">Insurance Products</h2>
        <span class="text-sm text-gray-400">{{ products.length }} product(s)</span>
      </div>

      <!-- Success / error banner -->
      <div *ngIf="successMsg"
           class="mb-4 flex items-center gap-2 bg-green-900/40 border border-green-700 text-green-300 px-4 py-2.5 rounded text-sm">
        <span class="material-symbols-outlined text-base">check_circle</span>
        {{ successMsg }}
      </div>
      <div *ngIf="errorMsg"
           class="mb-4 flex items-center gap-2 bg-red-900/40 border border-red-700 text-red-300 px-4 py-2.5 rounded text-sm">
        <span class="material-symbols-outlined text-base">error</span>
        {{ errorMsg }}
      </div>

      <!-- Add / Edit product form -->
      <div class="bg-gray-800 rounded-lg p-5 mb-6 border border-gray-700">
        <h3 class="font-semibold mb-4 text-sm uppercase text-gray-400 tracking-wider">
          {{ editId ? 'Edit Product' : 'Add New Product' }}
        </h3>

        <!-- Basic fields row -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Product Code *</label>
            <input [(ngModel)]="form.code" placeholder="e.g. TERM-BASIC"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Product Name *</label>
            <input [(ngModel)]="form.name" placeholder="e.g. Term Life Basic"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Base Monthly Premium (LKR) *</label>
            <input [(ngModel)]="form.basePremium" type="number" min="0" placeholder="e.g. 3500"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <!-- Tag checkboxes -->
        <div class="mb-4">
          <label class="block text-xs text-gray-400 mb-2">Product Tags (select all that apply)</label>
          <div class="flex flex-wrap gap-2">
            <label *ngFor="let tag of commonTags" class="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox"
                [checked]="selectedTags.has(tag.value)"
                (change)="toggleTag(tag.value)"
                class="accent-blue-500 w-4 h-4" />
              <span class="text-sm text-gray-300">{{ tag.label }}</span>
            </label>
          </div>

          <!-- Custom tag input -->
          <div class="flex gap-2 mt-3">
            <input [(ngModel)]="customTagInput" placeholder="Add custom tag…"
              class="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
              (keydown.enter)="addCustomTag()" />
            <button (click)="addCustomTag()"
              class="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors">
              + Add
            </button>
          </div>

          <!-- Selected tags preview -->
          <div *ngIf="selectedTags.size > 0" class="flex flex-wrap gap-1.5 mt-2">
            <span *ngFor="let tag of selectedTagsArray"
              class="flex items-center gap-1 bg-blue-700/50 text-blue-200 text-xs px-2 py-0.5 rounded-full border border-blue-600">
              {{ tag }}
              <button (click)="removeTag(tag)" class="ml-0.5 hover:text-white">✕</button>
            </span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Tags stored as: {{ tagsJsonPreview }}</p>
        </div>

        <div class="flex gap-2">
          <button (click)="save()" [disabled]="!form.code || !form.name || !form.basePremium"
            class="px-5 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ editId ? 'Update Product' : 'Add Product' }}
          </button>
          <button *ngIf="editId" (click)="cancelEdit()"
            class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      <!-- Product table -->
      <div class="overflow-x-auto rounded-lg border border-gray-700">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-gray-400 uppercase bg-gray-800">
            <tr>
              <th class="px-4 py-3">Code</th>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Base Premium</th>
              <th class="px-4 py-3">Tags</th>
              <th class="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of products" class="border-t border-gray-700 hover:bg-gray-800 transition-colors">
              <td class="px-4 py-3 font-mono text-xs text-blue-400">{{ p.code }}</td>
              <td class="px-4 py-3 font-medium">{{ p.name }}</td>
              <td class="px-4 py-3 text-gray-300">LKR {{ p.basePremium | number:'1.0-0' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span *ngFor="let tag of parseTags(p.tagsJson)"
                    class="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{{ tag }}</span>
                  <span *ngIf="!parseTags(p.tagsJson).length" class="text-gray-600 text-xs">—</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-3">
                  <button (click)="edit(p)" class="text-blue-400 hover:text-blue-300 text-xs font-semibold">Edit</button>
                  <button (click)="remove(p.id)" class="text-red-400 hover:text-red-300 text-xs font-semibold">Delete</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="products.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                No products yet. Add your first product above.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminProductsComponent implements OnInit {
  products: any[] = [];
  editId: number | null = null;
  form = { code: '', name: '', basePremium: 0 };

  commonTags: TagOption[] = COMMON_TAGS;
  selectedTags = new Set<string>();
  customTagInput = '';

  successMsg: string | null = null;
  errorMsg: string | null = null;

  constructor(private api: AdminApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.listProducts().subscribe(p => (this.products = p));
  }

  get selectedTagsArray(): string[] {
    return Array.from(this.selectedTags);
  }

  get tagsJsonPreview(): string {
    return JSON.stringify(this.selectedTagsArray);
  }

  toggleTag(value: string): void {
    if (this.selectedTags.has(value)) {
      this.selectedTags.delete(value);
    } else {
      this.selectedTags.add(value);
    }
  }

  addCustomTag(): void {
    const tag = this.customTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag) {
      this.selectedTags.add(tag);
      this.customTagInput = '';
    }
  }

  removeTag(tag: string): void {
    this.selectedTags.delete(tag);
  }

  parseTags(tagsJson: string | null): string[] {
    if (!tagsJson) return [];
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(): void {
    const body = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      basePremium: Number(this.form.basePremium),
      tagsJson: JSON.stringify(this.selectedTagsArray),
    };

    if (this.editId) {
      this.api.updateProduct(this.editId, body).subscribe({
        next: () => { this.showSuccess('Product updated.'); this.cancelEdit(); this.load(); },
        error: () => this.showError('Failed to update product.'),
      });
    } else {
      this.api.createProduct(body).subscribe({
        next: () => { this.showSuccess('Product added successfully.'); this.resetForm(); this.load(); },
        error: () => this.showError('Failed to add product. Check that the code is unique.'),
      });
    }
  }

  edit(p: any): void {
    this.editId = p.id;
    this.form = { code: p.code, name: p.name, basePremium: p.basePremium };
    this.selectedTags = new Set(this.parseTags(p.tagsJson));
    this.errorMsg = null;
    this.successMsg = null;
  }

  cancelEdit(): void {
    this.editId = null;
    this.resetForm();
  }

  remove(id: number): void {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    this.api.deleteProduct(id).subscribe({
      next: () => { this.showSuccess('Product deleted.'); this.load(); },
      error: () => this.showError('Failed to delete product.'),
    });
  }

  private resetForm(): void {
    this.form = { code: '', name: '', basePremium: 0 };
    this.selectedTags = new Set();
    this.customTagInput = '';
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
