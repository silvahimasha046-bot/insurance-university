import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

const API_BASE = 'http://localhost:8080/api';
const TOKEN_KEY = 'admin_access_token';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<{ accessToken: string }> {
    return this.http
      .post<{ accessToken: string }>(`${API_BASE}/auth/admin/login`, { email, password })
      .pipe(tap(res => localStorage.setItem(TOKEN_KEY, res.accessToken)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/admin/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
