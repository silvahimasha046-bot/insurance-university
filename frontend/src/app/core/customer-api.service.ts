import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

const BASE_URL = "http://localhost:8080/api";
const SESSION_KEY = "insurance_customer_session_id";
const ACTIVE_SESSION_META_KEY = "insurance_customer_session_meta";

export interface CustomerSession {
  sessionId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSessionMeta {
  sessionId: string;
  createdAt: string;
}

export interface RankedProduct {
  code: string;
  name: string;
  policyType: string;
  score: number;
  monthlyPremiumEstimate: number;
  affordabilityScore: number;
  lapseProbability: number;
  reasons: string[];
  eligibilityDecision?: string;
  predictedCoverage?: number;
  suitabilityRank?: number;
  riderExclusions?: string[];
  category?: string;
  subCategory?: string;
  productMetadata?: {
    category?: string;
    subCategory?: string;
    benefits?: Array<Record<string, unknown>>;
    riders?: Array<Record<string, unknown>>;
    eligibility?: Record<string, unknown>;
    sampleCalculations?: Array<Record<string, unknown>>;
    paymentModes?: string[];
    howItWorks?: string;
    additionalBenefits?: string;
    minEligibleAge?: number;
    maxEligibleAge?: number;
    minPolicyTermYears?: number;
    maxPolicyTermYears?: number;
  };
  premiumExplanation?: {
    coverageAmount?: number;
    basePremiumUsed?: number;
    usedFallbackBasePremium?: boolean;
    coverageFactor?: number;
    coverageComponent?: number;
    riskMultiplier?: number;
    riskBreakdown?: Record<string, number>;
    premiumAfterRisk?: number;
    selectedRiderCount?: number;
    selectedRiderPremium?: number;
    riderBreakdown?: Array<Record<string, unknown>>;
    subTotal?: number;
    taxRate?: number;
    taxAmount?: number;
  };
}

export interface FollowUpQuestion {
  id: string;
  key: string;
  question: string;
  type: "text" | "number" | "boolean" | "select";
  required?: boolean;
  reason?: string;
  options?: string[];
  relatedPlans?: string[];
}

export interface RecommendationResponse {
  sessionId: string;
  rankedProducts: RankedProduct[];
  followUpQuestions?: FollowUpQuestion[];
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

  /** Store active session metadata used by post-login journey screens. */
  storeActiveSessionMeta(meta: ActiveSessionMeta): void {
    localStorage.setItem(ACTIVE_SESSION_META_KEY, JSON.stringify(meta));
  }

  /** Retrieve stored sessionId from localStorage. */
  getStoredSessionId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  /** Retrieve active session metadata from localStorage. */
  getActiveSessionMeta(): ActiveSessionMeta | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_META_KEY);
      return raw ? (JSON.parse(raw) as ActiveSessionMeta) : null;
    } catch {
      return null;
    }
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

  /** Delete a session (consent withdrawal). */
  deleteSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${BASE_URL}/customer/sessions/${sessionId}`);
  }

  /** Mark a session as completed. */
  completeSession(sessionId: string): Observable<{ sessionId: string; status: string; updatedAt: string }> {
    return this.http.patch<{ sessionId: string; status: string; updatedAt: string }>(
      `${BASE_URL}/customer/sessions/${sessionId}/complete`,
      {}
    );
  }

  /** List past sessions for the authenticated user. */
  listSessions(): Observable<CustomerSession[]> {
    return this.http.get<CustomerSession[]>(`${BASE_URL}/customer/sessions`);
  }
}
