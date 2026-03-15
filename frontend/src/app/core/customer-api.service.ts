import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

const BASE_URL = "http://localhost:8080/api";
const SESSION_KEY = "insurance_customer_session_id";

export interface RankedProduct {
  code: string;
  name: string;
  score: number;
  monthlyPremiumEstimate: number;
  reasons: string[];
}

export interface RecommendationResponse {
  sessionId: string;
  rankedProducts: RankedProduct[];
}

@Injectable({ providedIn: "root" })
export class CustomerApiService {
  constructor(private http: HttpClient) {}

  /** Create a new customer session and persist sessionId to localStorage. */
  createSession(): Observable<{ sessionId: string }> {
    return this.http.post<{ sessionId: string }>(`${BASE_URL}/customer/sessions`, {});
  }

  /** Store sessionId in localStorage. */
  storeSessionId(sessionId: string): void {
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  /** Retrieve stored sessionId from localStorage. */
  getStoredSessionId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  /** Submit wizard answers for the given session. */
  submitAnswers(sessionId: string, answers: Record<string, unknown>): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${BASE_URL}/customer/sessions/${sessionId}/answers`,
      answers
    );
  }

  /** Fetch AI-generated recommendations for a session. */
  getRecommendations(sessionId: string): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(
      `${BASE_URL}/customer/sessions/${sessionId}/recommendations`,
      {}
    );
  }
}
