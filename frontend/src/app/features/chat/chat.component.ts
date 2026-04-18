import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import {
  ChatHistoryMessage,
  CustomerApiService,
  MissingChatField,
  RankedProduct,
} from "../../core/customer-api.service";
import { CustomerAuthService } from "../../core/services/customer-auth.service";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./chat.component.html",
})
export class ChatComponent implements OnInit {
  isLoggedIn = false;
  activeSessionStartedAt: string | null = null;

  chatInput = "";
  chatMessages: ChatHistoryMessage[] = [];
  chatLoading = false;
  chatError: string | null = null;
  chatFallbackHint: string | null = null;
  lastFailedMessage: string | null = null;
  missingFields: MissingChatField[] = [];

  rankedPolicies: RankedProduct[] = [];

  constructor(
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    const activeMeta = this.customerApi.getActiveSessionMeta();
    this.activeSessionStartedAt = activeMeta?.createdAt ?? null;

    const existingSession = this.customerApi.getStoredSessionId();
    if (!existingSession) {
      this.customerApi.createSession().subscribe({
        next: (res) => {
          const createdAt = new Date().toISOString();
          this.customerApi.storeSessionId(res.sessionId);
          this.customerApi.storeActiveSessionMeta({ sessionId: res.sessionId, createdAt });
          this.activeSessionStartedAt = createdAt;
          this.loadChatHistory(res.sessionId);
          this.cd.detectChanges();
        },
        error: () => {
          this.chatError = "Could not initialize chat session. Please retry.";
          this.cd.detectChanges();
        },
      });
      return;
    }

    this.loadChatHistory(existingSession);
  }

  back(): void {
    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
      return;
    }
    this.router.navigateByUrl("/");
  }

  sendChat(): void {
    this.chatError = null;
    this.chatFallbackHint = null;
    const message = this.chatInput.trim();
    if (!message) return;

    const sessionId = this.customerApi.getStoredSessionId();
    if (!sessionId) {
      this.chatError = "Session is not ready yet. Please try again.";
      return;
    }

    this.chatMessages = [
      ...this.chatMessages,
      {
        id: Date.now(),
        role: "USER",
        message,
        createdAt: new Date().toISOString(),
      },
    ];
    this.chatInput = "";
    this.chatLoading = true;
    this.lastFailedMessage = message;

    this.customerApi.sendChatMessage(sessionId, message).subscribe({
      next: (res) => {
        this.missingFields = res.missingFields ?? [];
        this.chatMessages = [
          ...this.chatMessages,
          {
            id: Date.now() + 1,
            role: "AGENT",
            message: res.reply,
            createdAt: new Date().toISOString(),
          },
        ];

        this.rankedPolicies = res.recommendation?.rankedProducts ?? this.rankedPolicies;

        if (res.extractionMode === "deterministic_fallback") {
          this.chatFallbackHint =
            "Guided extraction fallback was used for this turn to keep results consistent.";
        }
        this.lastFailedMessage = null;
        this.chatLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.chatError = "Could not send chat message. Please try again.";
        this.chatLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  retryLastMessage(): void {
    if (this.chatLoading || !this.lastFailedMessage) {
      return;
    }
    this.chatInput = this.lastFailedMessage;
    this.sendChat();
  }

  private loadChatHistory(sessionId: string): void {
    this.customerApi.getChatHistory(sessionId).subscribe({
      next: (res) => {
        this.chatMessages = res.messages ?? [];
        if (this.chatMessages.length === 0) {
          this.chatMessages = [
            {
              id: 1,
              role: "AGENT",
              message:
                "Ayubowan. I will guide you with insurance onboarding questions and then list policy suitability for you.",
              createdAt: new Date().toISOString(),
            },
          ];
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.chatMessages = [
          {
            id: 1,
            role: "AGENT",
            message:
              "Ayubowan. I will guide you with insurance onboarding questions and then list policy suitability for you.",
            createdAt: new Date().toISOString(),
          },
        ];
        this.cd.detectChanges();
      },
    });
  }
}
