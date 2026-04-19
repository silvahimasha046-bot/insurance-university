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

export interface ChatHistoryMessage {
  id: number;
  role: "USER" | "AGENT";
  message: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MissingChatField {
  key: string;
  question: string;
}

export interface ChatTurnResponse {
  sessionId: string;
  reply: string;
  extractedAnswers: Record<string, unknown>;
  missingFields: MissingChatField[];
  recommendation?: RecommendationResponse;
  extractionMode?: string;
  fallbackReason?: string | null;
}

export type DocumentType = "nic" | "medical" | "income";
export type DocumentSide = "front" | "back";

// ---- Open Chat types ----

export interface OpenChatMessage {
  id: number;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string | null;
  toolName?: string | null;
  createdAt?: string;
}

export interface OpenChatSseEvent {
  event: "token" | "tool_start" | "tool_result" | "done" | "error";
  data: Record<string, unknown>;
}

export interface OpenChatDoneData {
  fullResponse: string;
  tokensUsed: number;
  toolsInvoked: string[];
}

export interface UploadedDocumentMeta {
  documentId: number;
  sessionId: string;
  docType: DocumentType;
  docSide?: DocumentSide;
  uploaded: boolean;
  originalFilename: string;
  uploadedAt?: string;
  versionNo?: number;
  downloadUrl?: string;
}

export interface SessionDocumentsResponse {
  sessionId: string;
  documents: UploadedDocumentMeta[];
}

export interface LatestUserDocumentsResponse {
  documents: UploadedDocumentMeta[];
}

@Injectable({ providedIn: "root" })
export class CustomerApiService {
  constructor(private http: HttpClient) {}

  /** Clear stored session id and active session metadata. */
  clearSessionData(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_SESSION_META_KEY);
  }

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

  /** Send one customer chat message and get an agent response with structured updates. */
  sendChatMessage(sessionId: string, message: string): Observable<ChatTurnResponse> {
    return this.http.post<ChatTurnResponse>(
      `${BASE_URL}/customer/sessions/${sessionId}/chat`,
      { message }
    );
  }

  /** Load persisted chat history for a customer session. */
  getChatHistory(sessionId: string): Observable<{ sessionId: string; messages: ChatHistoryMessage[] }> {
    return this.http.get<{ sessionId: string; messages: ChatHistoryMessage[] }>(
      `${BASE_URL}/customer/sessions/${sessionId}/chat/history`
    );
  }

  /** Fetch AI-generated recommendations for a session. */
  getRecommendations(sessionId: string): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(
      `${BASE_URL}/customer/sessions/${sessionId}/recommendations`,
      {}
    );
  }

  /** Fetch stored answers for a session (for form pre-population). */
  getSessionAnswers(sessionId: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      `${BASE_URL}/customer/sessions/${sessionId}/answers`
    );
  }

  /** Fetch the latest recommendation run for a session. */
  getLatestRecommendation(sessionId: string): Observable<{ runId: number; createdAt: string; data: RecommendationResponse }> {
    return this.http.get<{ runId: number; createdAt: string; data: RecommendationResponse }>(
      `${BASE_URL}/customer/sessions/${sessionId}/recommendations/latest`
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

  /** Upload or re-upload a session document. */
  uploadSessionDocument(
    sessionId: string,
    docType: DocumentType,
    file: File,
    docSide?: DocumentSide
  ): Observable<{ document: UploadedDocumentMeta }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    if (docSide) {
      formData.append("docSide", docSide);
    }
    return this.http.post<{ document: UploadedDocumentMeta }>(
      `${BASE_URL}/customer/sessions/${sessionId}/documents`,
      formData
    );
  }

  /** Fetch latest documents saved for a specific session. */
  getSessionDocuments(sessionId: string): Observable<SessionDocumentsResponse> {
    return this.http.get<SessionDocumentsResponse>(`${BASE_URL}/customer/sessions/${sessionId}/documents`);
  }

  /** Fetch latest reusable documents for authenticated user. */
  getLatestUserDocuments(): Observable<LatestUserDocumentsResponse> {
    return this.http.get<LatestUserDocumentsResponse>(`${BASE_URL}/customer/documents/latest`);
  }

  /** Download one uploaded session document as blob. */
  downloadSessionDocument(sessionId: string, documentId: number): Observable<Blob> {
    return this.http.get(`${BASE_URL}/customer/sessions/${sessionId}/documents/${documentId}/download`, {
      responseType: "blob",
    });
  }

  // ---- Open Chat (Agentic AI) ----

  /** Create a new open-chat session. */
  createOpenChatSession(): Observable<{ sessionId: string }> {
    return this.http.post<{ sessionId: string }>(`${BASE_URL}/customer/open-chat/sessions`, {});
  }

  /** Delete an open-chat session. */
  deleteOpenChatSession(sessionId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE_URL}/customer/open-chat/sessions/${sessionId}`);
  }

  /** Get conversation history for an open-chat session. */
  getOpenChatHistory(sessionId: string): Observable<{ sessionId: string; messages: OpenChatMessage[] }> {
    return this.http.get<{ sessionId: string; messages: OpenChatMessage[] }>(
      `${BASE_URL}/customer/open-chat/history/${sessionId}`
    );
  }

  /** Send a non-streaming open-chat message. */
  sendOpenChatMessage(sessionId: string, message: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${BASE_URL}/customer/open-chat/message`,
      { sessionId, message }
    );
  }

  /**
   * Stream an open-chat message via SSE using fetch + ReadableStream.
   * Returns an Observable that emits parsed SSE events.
   */
  streamOpenChatMessage(sessionId: string, message: string): Observable<OpenChatSseEvent> {
    return new Observable<OpenChatSseEvent>((subscriber) => {
      const token = localStorage.getItem('insurance_auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();

      fetch(`${BASE_URL}/customer/open-chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, message }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok || !response.body) {
            subscriber.error(new Error(`HTTP ${response.status}`));
            return;
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'token';

          const read = (): void => {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  subscriber.complete();
                  return;
                }
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const rawLine of lines) {
                  const line = rawLine.replace(/\r$/, '');
                  if (line.startsWith('event:')) {
                    currentEvent = line.substring(6).trim();
                  } else if (line.startsWith('data:')) {
                    try {
                      const data = JSON.parse(line.substring(5).trim());
                      subscriber.next({
                        event: currentEvent as OpenChatSseEvent['event'],
                        data,
                      });
                    } catch {
                      // skip malformed JSON
                    }
                  }
                }
                read();
              })
              .catch((err) => {
                if (err.name !== 'AbortError') {
                  subscriber.error(err);
                }
              });
          };

          read();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            subscriber.error(err);
          }
        });

      return () => controller.abort();
    });
  }
}
