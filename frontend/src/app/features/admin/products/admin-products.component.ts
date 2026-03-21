import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <h2 class="text-xl font-bold mb-4">Insurance Products</h2>

      <!-- Add product form -->
      <div class="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 class="font-semibold mb-3 text-sm uppercase text-gray-400">{{ editId ? 'Edit Product' : 'Add New Product' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input [(ngModel)]="form.code" placeholder="Code (e.g. TERM-BASIC)"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-primary" />
          <input [(ngModel)]="form.name" placeholder="Product Name"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-primary" />
          <input [(ngModel)]="form.basePremium" type="number" placeholder="Base Premium (LKR)"
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-primary" />
          <input [(ngModel)]="form.tagsJson" placeholder='Tags JSON e.g. ["life","term"]'
            class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-primary" />
        </div>
        <div class="flex gap-2 mt-3">
          <button (click)="save()"
            class="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-primary/90">
            {{ editId ? 'Update Product' : 'Add Product' }}
          </button>
          <button *ngIf="editId" (click)="cancelEdit()"
            class="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">
            Cancel
          </button>
        </div>
      </div>

      <!-- Product table -->
      <div class="overflow-x-auto">
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
            <tr *ngFor="let p of products" class="border-b border-gray-700 hover:bg-gray-800">
              <td class="px-4 py-3 font-mono text-xs text-primary">{{ p.code }}</td>
              <td class="px-4 py-3">{{ p.name }}</td>
              <td class="px-4 py-3">LKR {{ p.basePremium | number:'1.0-0' }}</td>
              <td class="px-4 py-3 text-gray-400 text-xs">{{ p.tagsJson }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-3">
                  <button (click)="edit(p)" class="text-blue-400 hover:text-blue-300 text-xs font-semibold">Edit</button>
                  <button (click)="remove(p.id)" class="text-red-400 hover:text-red-300 text-xs font-semibold">Delete</button>
                </div>
              </td>
            </tr>
            <tr *ngIf="products.length === 0">
              <td colspan="5" class="px-4 py-6 text-center text-gray-500">No products found.</td>
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
  form = { code: '', name: '', basePremium: 0, tagsJson: '[]' };

  constructor(private api: AdminApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.listProducts().subscribe(p => (this.products = p));
  }

  save(): void {
    const body = { ...this.form, basePremium: Number(this.form.basePremium) };
    if (this.editId) {
      this.api.updateProduct(this.editId, body).subscribe(() => { this.cancelEdit(); this.load(); });
    } else {
      this.api.createProduct(body).subscribe(() => { this.resetForm(); this.load(); });
    }
  }

  edit(p: any): void {
    this.editId = p.id;
    this.form = { code: p.code, name: p.name, basePremium: p.basePremium, tagsJson: p.tagsJson ?? '[]' };
  }

  cancelEdit(): void {
    this.editId = null;
    this.resetForm();
  }

  remove(id: number): void {
    if (!confirm('Delete this product?')) return;
    this.api.deleteProduct(id).subscribe(() => this.load());
  }

  private resetForm(): void {
    this.form = { code: '', name: '', basePremium: 0, tagsJson: '[]' };
  }
}
