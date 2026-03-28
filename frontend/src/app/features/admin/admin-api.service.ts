import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:8080/api/admin';

export interface AdminCategory {
  id: number;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
}

export interface AdminSubcategory {
  id: number;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
  category?: Partial<AdminCategory>;
}

export interface AdminProduct {
  id?: number;
  code: string;
  name: string;
  basePremium: number;
  tagsJson?: string;
  category?: AdminCategory | null;
  subcategory?: AdminSubcategory | null;
  howItWorksText?: string;
  benefitsJson?: string;
  ridersJson?: string;
  eligibilityJson?: string;
  sampleCalculationsJson?: string;
  paymentModesJson?: string;
  additionalBenefitsText?: string;
  minEligibleAge?: number | null;
  maxEligibleAge?: number | null;
  minPolicyTermYears?: number | null;
  maxPolicyTermYears?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private http: HttpClient) {}

  // Products
  listProducts(categoryId?: number | null, subcategoryId?: number | null): Observable<AdminProduct[]> {
    let params = new HttpParams();
    if (categoryId != null) params = params.set('categoryId', String(categoryId));
    if (subcategoryId != null) params = params.set('subcategoryId', String(subcategoryId));
    return this.http.get<AdminProduct[]>(`${API}/products`, { params });
  }
  createProduct(body: AdminProduct): Observable<AdminProduct> { return this.http.post<AdminProduct>(`${API}/products`, body); }
  updateProduct(id: number, body: AdminProduct): Observable<AdminProduct> { return this.http.put<AdminProduct>(`${API}/products/${id}`, body); }
  deleteProduct(id: number): Observable<any> { return this.http.delete(`${API}/products/${id}`); }

  // Product hierarchy
  listCategories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${API}/categories`);
  }

  createCategory(body: Partial<AdminCategory>): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(`${API}/categories`, body);
  }

  updateCategory(id: number, body: Partial<AdminCategory>): Observable<AdminCategory> {
    return this.http.put<AdminCategory>(`${API}/categories/${id}`, body);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/categories/${id}`);
  }

  listSubcategories(categoryId?: number | null): Observable<AdminSubcategory[]> {
    let params = new HttpParams();
    if (categoryId != null) params = params.set('categoryId', String(categoryId));
    return this.http.get<AdminSubcategory[]>(`${API}/subcategories`, { params });
  }

  createSubcategory(body: Partial<AdminSubcategory>): Observable<AdminSubcategory> {
    return this.http.post<AdminSubcategory>(`${API}/subcategories`, body);
  }

  updateSubcategory(id: number, body: Partial<AdminSubcategory>): Observable<AdminSubcategory> {
    return this.http.put<AdminSubcategory>(`${API}/subcategories/${id}`, body);
  }

  deleteSubcategory(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/subcategories/${id}`);
  }

  // Rules
  listRules(): Observable<any[]> { return this.http.get<any[]>(`${API}/rules`); }
  createRule(body: any): Observable<any> { return this.http.post(`${API}/rules`, body); }
  deleteRule(id: number): Observable<any> { return this.http.delete(`${API}/rules/${id}`); }

  // Pricing Tables
  listPricingTables(): Observable<any[]> { return this.http.get<any[]>(`${API}/pricing-tables`); }
  createPricingTable(body: any): Observable<any> { return this.http.post(`${API}/pricing-tables`, body); }
  deletePricingTable(id: number): Observable<any> { return this.http.delete(`${API}/pricing-tables/${id}`); }

  // Training Datasets
  uploadDataset(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`${API}/training/datasets`, fd);
  }
  listDatasets(): Observable<any[]> { return this.http.get<any[]>(`${API}/training/datasets`); }
  retrainDataset(id: number): Observable<any> { return this.http.post(`${API}/training/datasets/${id}/retrain`, {}); }

  // Model Versions
  createModel(body: any): Observable<any> { return this.http.post(`${API}/training/models`, body); }
  listModels(): Observable<any[]> { return this.http.get<any[]>(`${API}/training/models`); }
  promoteModel(id: number): Observable<any> { return this.http.post(`${API}/training/models/${id}/promote`, {}); }

  // Logs
  searchLogs(filters: any): Observable<any> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v)); });
    return this.http.get(`${API}/logs`, { params });
  }
  exportLogs(filters: any, format: string): string {
    let params = new HttpParams().set('format', format);
    Object.entries(filters).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v)); });
    return `${API}/logs/export?${params.toString()}`;
  }

  // Insights
  listNeeds(): Observable<any[]> { return this.http.get<any[]>(`${API}/insights/unmatched-needs`); }
  createNeed(body: any): Observable<any> { return this.http.post(`${API}/insights/unmatched-needs`, body); }
  deleteNeed(id: number): Observable<any> { return this.http.delete(`${API}/insights/unmatched-needs/${id}`); }

  // Dev Seed
  devSeed(): Observable<any> { return this.http.post(`${API}/dev/seed`, {}); }
}
