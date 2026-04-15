import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { WizardStateService } from "../../../core/state/wizard-state.service";
import { CustomerApiService } from "../../../core/customer-api.service";
import { CustomerAuthService } from "../../../core/services/customer-auth.service";

const CONSENT_KEY = "insurance_privacy_consent_v1";

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

@Component({
  selector: "app-wizard-step-1",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./wizard-step-1.component.html",
})
export class WizardStep1Component implements OnInit, OnDestroy {
  needsText = "";
  isPep = false;
  hasCriminalHistory = false;
  educationLevel: "Postgrad" | "Undergrad" | "College" | "HighSchool" | "Elementary" = "Undergrad";
  occupation = "";
  occupationHazardLevel = 1;

  showConsentModal = false;
  isLoggedIn = false;
  activeSessionStartedAt: string | null = null;
  isRecording = false;
  speechSupported = false;
  voiceError = "";

  private recognition: BrowserSpeechRecognition | null = null;
  private heardSpeechInCurrentSession = false;
  private capturedFinalInCurrentSession = false;
  private interimTranscript = "";

  constructor(
    private wizard: WizardStateService,
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {
    const s = this.wizard.snapshot.step1;
    if (typeof s?.needsText === "string") this.needsText = s.needsText;
    if (typeof s?.isPep === "boolean") this.isPep = s.isPep;
    if (typeof s?.hasCriminalHistory === "boolean") this.hasCriminalHistory = s.hasCriminalHistory;
    if (s?.educationLevel) this.educationLevel = s.educationLevel;
    if (typeof s?.occupation === "string") this.occupation = s.occupation;
    if (typeof s?.occupationHazardLevel === "number") this.occupationHazardLevel = s.occupationHazardLevel;
  }

  ngOnInit(): void {
    this.speechSupported = !!this.getSpeechRecognitionCtor();

    this.isLoggedIn = this.auth.isLoggedIn();
    const activeMeta = this.customerApi.getActiveSessionMeta();
    this.activeSessionStartedAt = activeMeta?.createdAt ?? null;

    if (!localStorage.getItem(CONSENT_KEY)) {
      this.showConsentModal = true;
    }

    // Skip auto-session creation in continuation mode
    if (this.wizard.snapshot.isContinuingSession) {
      return;
    }

    if (!this.customerApi.getStoredSessionId()) {
      this.customerApi.clearSessionData();
      this.wizard.clear();
      this.needsText = "";
      this.isPep = false;
      this.hasCriminalHistory = false;
      this.educationLevel = "Undergrad";
      this.occupation = "";
      this.occupationHazardLevel = 1;
      this.customerApi.createSession().subscribe({
        next: (res) => {
          this.customerApi.storeSessionId(res.sessionId);
          this.cd.detectChanges();
        },
        error: (err) => {
          console.warn("Could not create customer session", err);
          this.cd.detectChanges();
        },
      });
    }
  }

  ngOnDestroy(): void {
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      try {
        this.recognition.abort();
      } catch {
        // Ignore abort errors when recognition is already stopped.
      }
    }
  }

  acceptConsent(): void {
    localStorage.setItem(CONSENT_KEY, "accepted");
    this.showConsentModal = false;
  }

  declineConsent(): void {
    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
      return;
    }
    this.router.navigateByUrl("/");
  }

  back(): void {
    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
      return;
    }
    this.router.navigateByUrl("/");
  }

  withdrawConsent(): void {
    localStorage.removeItem(CONSENT_KEY);
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi.deleteSession(sessionId).subscribe({
        next: () => {
          this.cd.detectChanges();
        },
        error: (err) => {
          console.warn("Could not delete session from backend", err);
          this.cd.detectChanges();
        },
      });
      this.customerApi.clearSessionData();
    }
    this.wizard.clear();
    this.router.navigateByUrl("/");
  }

  persist(): void {
    this.wizard.updateStep1({
      needsText: this.needsText,
      isPep: this.isPep,
      hasCriminalHistory: this.hasCriminalHistory,
      educationLevel: this.educationLevel,
      occupation: this.occupation,
      occupationHazardLevel: this.occupationHazardLevel,
    });
  }

  startVoiceInput(): void {
    this.voiceError = "";
    this.heardSpeechInCurrentSession = false;
    this.capturedFinalInCurrentSession = false;
    this.interimTranscript = "";

    const RecognitionCtor = this.getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      this.speechSupported = false;
      this.voiceError = "Voice input is not supported in this browser.";
      return;
    }

    if (!this.recognition) {
      this.recognition = new RecognitionCtor();
      this.recognition.lang = "en-US";
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript ?? "";
          if (transcript.trim()) {
            this.heardSpeechInCurrentSession = true;
          }
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            this.capturedFinalInCurrentSession = true;
          } else {
            interimTranscript += transcript;
          }
        }
        this.interimTranscript = interimTranscript.trim();
        if (finalTranscript.trim()) {
          this.appendNeedsText(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech" && this.heardSpeechInCurrentSession) {
          return;
        }
        if (event.error === "not-allowed") {
          this.voiceError = "Microphone permission denied. Please allow access and try again.";
        } else if (event.error === "no-speech") {
          this.voiceError = "No speech detected. Please try again.";
        } else if (event.error === "audio-capture") {
          this.voiceError = "No microphone was found. Please check your device.";
        } else {
          this.voiceError = "Voice input failed. Please try again.";
        }
        this.isRecording = false;
        this.cd.detectChanges();
      };

      this.recognition.onend = () => {
        if (!this.capturedFinalInCurrentSession && this.interimTranscript) {
          this.appendNeedsText(this.interimTranscript);
        }
        this.isRecording = false;
        this.heardSpeechInCurrentSession = false;
        this.capturedFinalInCurrentSession = false;
        this.interimTranscript = "";
        this.cd.detectChanges();
      };
    }

    try {
      this.recognition.start();
      this.isRecording = true;
      this.cd.detectChanges();
    } catch {
      // SpeechRecognition throws if start is called while active.
      this.isRecording = true;
    }
  }

  stopVoiceInput(): void {
    if (!this.recognition) return;
    this.recognition.stop();
    this.isRecording = false;
  }

  next(): void {
    this.persist();
    const sessionId = this.customerApi.getStoredSessionId();
    if (sessionId) {
      this.customerApi
        .submitAnswers(sessionId, {
          needsText: this.needsText,
          isPep: this.isPep,
          hasCriminalHistory: this.hasCriminalHistory,
          educationLevel: this.educationLevel,
          occupation: this.occupation,
          occupationHazardLevel: this.occupationHazardLevel,
        })
        .subscribe({
          next: () => this.cd.detectChanges(),
          error: (err) => {
            console.warn("Could not save step-1 answers", err);
            this.cd.detectChanges();
          },
        });
    }
    this.router.navigateByUrl("/wizard/step-2");
  }

  private appendNeedsText(transcript: string): void {
    const current = this.needsText.trim();
    this.needsText = current ? `${current} ${transcript}` : transcript;
    this.persist();
    this.cd.detectChanges();
  }

  private getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
    const w = window as Window & {
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }
}
