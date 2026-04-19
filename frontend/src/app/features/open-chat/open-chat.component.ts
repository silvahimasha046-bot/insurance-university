import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import {
  CustomerApiService,
  OpenChatMessage,
  OpenChatSseEvent,
} from "../../core/customer-api.service";
import { CustomerAuthService } from "../../core/services/customer-auth.service";
import { Subscription } from "rxjs";

interface DisplayMessage {
  id: number;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  streaming?: boolean;
  toolName?: string | null;
  createdAt?: string;
}

const OPEN_CHAT_SESSION_KEY = "open_chat_session_id";

@Component({
  selector: "app-open-chat",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./open-chat.component.html",
})
export class OpenChatComponent implements OnInit, OnDestroy {
  @ViewChild("chatContainer") chatContainer!: ElementRef<HTMLDivElement>;

  isLoggedIn = false;
  sessionId: string | null = null;

  chatInput = "";
  messages: DisplayMessage[] = [];
  isStreaming = false;
  error: string | null = null;
  activeTool: string | null = null;

  private streamSub: Subscription | null = null;

  constructor(
    private customerApi: CustomerApiService,
    private auth: CustomerAuthService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    const stored = localStorage.getItem(OPEN_CHAT_SESSION_KEY);
    if (stored) {
      this.sessionId = stored;
      this.loadHistory(stored);
    } else {
      this.createSession();
    }
  }

  ngOnDestroy(): void {
    this.streamSub?.unsubscribe();
  }

  back(): void {
    if (this.isLoggedIn) {
      this.router.navigateByUrl("/customer/dashboard");
    } else {
      this.router.navigateByUrl("/");
    }
  }

  newConversation(): void {
    localStorage.removeItem(OPEN_CHAT_SESSION_KEY);
    this.messages = [];
    this.sessionId = null;
    this.error = null;
    this.activeTool = null;
    this.createSession();
  }

  sendMessage(): void {
    this.error = null;
    const text = this.chatInput.trim();
    if (!text || this.isStreaming || !this.sessionId) return;

    // Add user message
    this.messages = [
      ...this.messages,
      {
        id: Date.now(),
        role: "USER",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ];
    this.chatInput = "";
    this.isStreaming = true;
    this.activeTool = null;
    this.cd.detectChanges();
    this.scrollToBottom();

    // Create a placeholder assistant message for streaming
    const assistantMsg: DisplayMessage = {
      id: Date.now() + 1,
      role: "ASSISTANT",
      content: "",
      streaming: true,
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, assistantMsg];
    this.cd.detectChanges();

    this.streamSub = this.customerApi
      .streamOpenChatMessage(this.sessionId, text)
      .subscribe({
        next: (event: OpenChatSseEvent) => {
          this.handleSseEvent(event, assistantMsg);
        },
        error: (err) => {
          this.isStreaming = false;
          assistantMsg.streaming = false;
          this.error = "Failed to get response. Please try again.";
          if (!assistantMsg.content) {
            // Remove empty assistant placeholder
            this.messages = this.messages.filter((m) => m.id !== assistantMsg.id);
          }
          this.cd.detectChanges();
        },
        complete: () => {
          this.isStreaming = false;
          assistantMsg.streaming = false;
          this.activeTool = null;
          this.cd.detectChanges();
        },
      });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  retryLast(): void {
    if (this.isStreaming) return;
    // Find the last user message
    const lastUser = [...this.messages]
      .reverse()
      .find((m) => m.role === "USER");
    if (lastUser) {
      // Remove the last user + assistant pair
      const lastUserIdx = this.messages.lastIndexOf(lastUser);
      this.messages = this.messages.slice(0, lastUserIdx);
      this.chatInput = lastUser.content;
      this.error = null;
      this.cd.detectChanges();
      this.sendMessage();
    }
  }

  // ---- formatting helpers ----

  formatContent(content: string): string {
    if (!content) return "";
    // Simple markdown-ish formatting
    let html = this.escapeHtml(content);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">$1</code>');
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    // Numbered lists
    html = html.replace(
      /^(\d+)\.\s+(.+)$/gm,
      '<div class="ml-4">$1. $2</div>'
    );
    // Bullet lists
    html = html.replace(
      /^[•\-]\s+(.+)$/gm,
      '<div class="ml-4">• $1</div>'
    );
    return html;
  }

  getToolDisplayName(tool: string): string {
    const names: Record<string, string> = {
      insurance_knowledge_base: "Searching insurance knowledge base",
      database_query: "Querying database",
      web_search: "Searching the web",
      calculator: "Calculating",
      policy_scoring: "Scoring policies",
    };
    return names[tool] || `Using ${tool}`;
  }

  // ---- private ----

  private handleSseEvent(event: OpenChatSseEvent, assistantMsg: DisplayMessage): void {
    switch (event.event) {
      case "token":
        assistantMsg.content += (event.data["content"] as string) || "";
        this.messages = [...this.messages]; // trigger change detection
        this.cd.detectChanges();
        this.scrollToBottom();
        break;

      case "tool_start":
        this.activeTool = (event.data["tool"] as string) || null;
        this.cd.detectChanges();
        break;

      case "tool_result":
        this.activeTool = null;
        this.cd.detectChanges();
        break;

      case "done":
        assistantMsg.streaming = false;
        this.isStreaming = false;
        this.activeTool = null;
        const fullResp = event.data["fullResponse"] as string;
        if (fullResp) {
          assistantMsg.content = fullResp;
        }
        this.messages = [...this.messages];
        this.cd.detectChanges();
        this.scrollToBottom();
        break;

      case "error":
        this.error = (event.data["message"] as string) || "An error occurred.";
        assistantMsg.streaming = false;
        this.isStreaming = false;
        this.activeTool = null;
        this.cd.detectChanges();
        break;
    }
  }

  private createSession(): void {
    this.customerApi.createOpenChatSession().subscribe({
      next: (res) => {
        this.sessionId = res.sessionId;
        localStorage.setItem(OPEN_CHAT_SESSION_KEY, res.sessionId);
        // Add welcome message
        this.messages = [
          {
            id: 1,
            role: "ASSISTANT",
            content:
              "Hello! I'm your AI assistant. I can help with anything — insurance questions, general knowledge, calculations, or just a conversation. How can I help you today?",
            createdAt: new Date().toISOString(),
          },
        ];
        this.cd.detectChanges();
      },
      error: () => {
        this.error = "Could not create chat session. Please refresh.";
        this.cd.detectChanges();
      },
    });
  }

  private loadHistory(sessionId: string): void {
    this.customerApi.getOpenChatHistory(sessionId).subscribe({
      next: (res) => {
        if (res.messages && res.messages.length > 0) {
          this.messages = res.messages
            .filter((m) => m.role !== "TOOL")
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content || "",
              createdAt: m.createdAt,
            }));
        } else {
          this.messages = [
            {
              id: 1,
              role: "ASSISTANT",
              content:
                "Hello! I'm your AI assistant. I can help with anything — insurance questions, general knowledge, calculations, or just a conversation. How can I help you today?",
              createdAt: new Date().toISOString(),
            },
          ];
        }
        this.cd.detectChanges();
        this.scrollToBottom();
      },
      error: () => {
        this.messages = [
          {
            id: 1,
            role: "ASSISTANT",
            content:
              "Hello! I'm your AI assistant. I can help with anything — insurance questions, general knowledge, calculations, or just a conversation. How can I help you today?",
            createdAt: new Date().toISOString(),
          },
        ];
        this.cd.detectChanges();
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatContainer?.nativeElement) {
        const el = this.chatContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
