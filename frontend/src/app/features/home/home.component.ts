import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

const LANG_KEY = "insurance_ui_language";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
})
export class HomeComponent implements OnInit {
  langMenuOpen = false;
  selectedLangLabel = "EN";

  ngOnInit(): void {
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

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest("[data-lang-dropdown]")) {
      this.langMenuOpen = false;
    }
  }
}
