import { Component, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-landing",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./landing.component.html",
  styleUrl: "./landing.component.scss",
})
export class LandingComponent {
  langMenuOpen = false;
  selectedLangLabel = "EN";

  toggleLang(): void {
    this.langMenuOpen = !this.langMenuOpen;
  }

  setLanguage(code: "en" | "si", label: string): void {
    this.selectedLangLabel = label;
    this.langMenuOpen = false;
    console.log("Language selected:", code);
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