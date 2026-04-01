import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  AdminCategory,
  AdminSubcategory,
} from '../admin-api.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-categories.component.html',
})
export class AdminCategoriesComponent implements OnInit {
  categories: AdminCategory[] = [];
  subcategories: AdminSubcategory[] = [];

  editingCategoryId: number | null = null;
  categoryForm = {
    code: '',
    name: '',
    description: '',
    active: true,
    displayOrder: 0,
  };

  editingSubcategoryId: number | null = null;
  subcategoryForm = {
    categoryId: null as number | null,
    code: '',
    name: '',
    description: '',
    active: true,
    displayOrder: 0,
  };

  successMsg: string | null = null;
  errorMsg: string | null = null;
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  pendingDelete: { type: 'category' | 'subcategory'; id: number } | null = null;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.api.listCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load categories.');
        this.cd.detectChanges();
      },
    });
    this.api.listSubcategories().subscribe({
      next: (data) => {
        this.subcategories = data;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load subcategories.');
        this.cd.detectChanges();
      },
    });
  }

  saveCategory(): void {
    const body = {
      code: this.categoryForm.code.trim(),
      name: this.categoryForm.name.trim(),
      description: this.categoryForm.description?.trim(),
      active: this.categoryForm.active,
      displayOrder: Number(this.categoryForm.displayOrder) || 0,
    };

    if (!body.code || !body.name) {
      this.showError('Category code and name are required.');
      return;
    }

    const req = this.editingCategoryId
      ? this.api.updateCategory(this.editingCategoryId, body)
      : this.api.createCategory(body);

    req.subscribe({
      next: () => {
        this.showSuccess(this.editingCategoryId ? 'Category updated.' : 'Category created.');
        this.resetCategoryForm();
        this.cd.detectChanges();
        this.loadAll();
      },
      error: () => {
        this.showError('Failed to save category.');
        this.cd.detectChanges();
      },
    });
  }

  editCategory(c: AdminCategory): void {
    this.editingCategoryId = c.id;
    this.categoryForm = {
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      active: c.active ?? true,
      displayOrder: c.displayOrder ?? 0,
    };
  }

  removeCategory(id: number): void {
    if (!id) return;
    this.pendingDelete = { type: 'category', id };
    this.confirmTitle = 'Delete category?';
    this.confirmMessage = 'Linked subcategories or products may fail validation after delete.';
    this.confirmOpen = true;
  }

  removeSubcategory(id: number): void {
    if (!id) return;
    this.pendingDelete = { type: 'subcategory', id };
    this.confirmTitle = 'Delete subcategory?';
    this.confirmMessage = 'Linked products may fail validation after delete.';
    this.confirmOpen = true;
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

    if (type === 'category') {
      this.deleteCategory(id);
      return;
    }
    this.deleteSubcategory(id);
  }

  private deleteCategory(id: number): void {
    this.api.deleteCategory(id).subscribe({
      next: () => {
        this.showSuccess('Category deleted.');
        this.cd.detectChanges();
        this.loadAll();
      },
      error: () => {
        this.showError('Failed to delete category. Remove dependent subcategories first.');
        this.cd.detectChanges();
      },
    });
  }

  saveSubcategory(): void {
    const body = {
      code: this.subcategoryForm.code.trim(),
      name: this.subcategoryForm.name.trim(),
      description: this.subcategoryForm.description?.trim(),
      active: this.subcategoryForm.active,
      displayOrder: Number(this.subcategoryForm.displayOrder) || 0,
      category: this.subcategoryForm.categoryId ? { id: this.subcategoryForm.categoryId } : undefined,
    };

    if (!body.code || !body.name || !body.category) {
      this.showError('Subcategory code, name and category are required.');
      return;
    }

    const req = this.editingSubcategoryId
      ? this.api.updateSubcategory(this.editingSubcategoryId, body)
      : this.api.createSubcategory(body);

    req.subscribe({
      next: () => {
        this.showSuccess(this.editingSubcategoryId ? 'Subcategory updated.' : 'Subcategory created.');
        this.resetSubcategoryForm();
        this.cd.detectChanges();
        this.loadAll();
      },
      error: () => {
        this.showError('Failed to save subcategory.');
        this.cd.detectChanges();
      },
    });
  }

  editSubcategory(s: AdminSubcategory): void {
    this.editingSubcategoryId = s.id;
    this.subcategoryForm = {
      categoryId: s.category?.id ?? null,
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      active: s.active ?? true,
      displayOrder: s.displayOrder ?? 0,
    };
  }

  private deleteSubcategory(id: number): void {
    this.api.deleteSubcategory(id).subscribe({
      next: () => {
        this.showSuccess('Subcategory deleted.');
        this.cd.detectChanges();
        this.loadAll();
      },
      error: () => {
        this.showError('Failed to delete subcategory. Remove dependent products first.');
        this.cd.detectChanges();
      },
    });
  }

  resetCategoryForm(): void {
    this.editingCategoryId = null;
    this.categoryForm = { code: '', name: '', description: '', active: true, displayOrder: 0 };
  }

  resetSubcategoryForm(): void {
    this.editingSubcategoryId = null;
    this.subcategoryForm = {
      categoryId: null,
      code: '',
      name: '',
      description: '',
      active: true,
      displayOrder: 0,
    };
  }

  private showSuccess(message: string): void {
    this.successMsg = message;
    this.errorMsg = null;
    setTimeout(() => (this.successMsg = null), 3500);
  }

  private showError(message: string): void {
    this.errorMsg = message;
    this.successMsg = null;
    setTimeout(() => (this.errorMsg = null), 5500);
  }
}
