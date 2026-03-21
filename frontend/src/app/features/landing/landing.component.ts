import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

const LANG_KEY = "insurance_ui_language";

@Component({
  selector: "app-landing",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./landing.component.html",
  styleUrl: "./landing.component.scss",
})
export class LandingComponent implements OnInit {
  langMenuOpen = false;
  selectedLangLabel = "EN";
  isLoggedIn = false;

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem("insurance_auth_token");
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "si") this.selectedLangLabel = "සිං";
    else this.selectedLangLabel = "EN";
  }

  toggleLang(): void {
    this.langMenuOpen = !this.langMenuOpen;
  }

  setLanguage(code: "en" | "si", label: string): void {
    this.selectedLangLabel = label;
    this.langMenuOpen = false;
    localStorage.setItem(LANG_KEY, code);
  }

  logout(): void {
    localStorage.removeItem("insurance_auth_token");
    localStorage.removeItem("insurance_customer_session_id");
    this.isLoggedIn = false;
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest("[data-lang-dropdown]")) {
      this.langMenuOpen = false;
    }
  }
}