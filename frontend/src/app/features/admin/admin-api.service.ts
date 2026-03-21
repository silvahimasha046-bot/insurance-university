import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:8080/api/admin';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private http: HttpClient) {}

  // Products
  listProducts(): Observable<any[]> { return this.http.get<any[]>(`${API}/products`); }
  createProduct(body: any): Observable<any> { return this.http.post(`${API}/products`, body); }
  updateProduct(id: number, body: any): Observable<any> { return this.http.put(`${API}/products/${id}`, body); }
  deleteProduct(id: number): Observable<any> { return this.http.delete(`${API}/products/${id}`); }

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
