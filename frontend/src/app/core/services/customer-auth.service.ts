import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

const API_BASE = 'http://localhost:8080/api';
const TOKEN_KEY = 'insurance_auth_token';
const USER_NAME_KEY = 'insurance_user_name';
const USER_EMAIL_KEY = 'insurance_user_email';
const SESSION_KEY = 'insurance_customer_session_id';
const ACTIVE_SESSION_META_KEY = 'insurance_customer_session_meta';

export interface CustomerProfile {
  name: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  constructor(private http: HttpClient, private router: Router) {}

  storeSession(token: string, name: string, email: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_NAME_KEY, name);
    localStorage.setItem(USER_EMAIL_KEY, email);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUserName(): string {
    return localStorage.getItem(USER_NAME_KEY) ?? '';
  }

  getUserEmail(): string {
    return localStorage.getItem(USER_EMAIL_KEY) ?? '';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_SESSION_META_KEY);
    this.router.navigate(['/login']);
  }

  /** Fetch the authenticated customer's profile from the backend. */
  getProfile(): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${API_BASE}/auth/me`);
  }
}
