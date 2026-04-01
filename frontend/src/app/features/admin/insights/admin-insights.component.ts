import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-insights',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-insights.component.html',
})
export class AdminInsightsComponent implements OnInit {
  needs: any[] = [];
  newNeed = { theme: '', occurrences: 1, sampleAnonymisedText: '' };
  confirmDeleteOpen = false;
  deleteCandidateId: number | null = null;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNeeds();
  }

  loadNeeds(): void {
    this.api.listNeeds().subscribe({
      next: (n) => {
        this.needs = n;
        this.cd.detectChanges();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  createNeed(): void {
    this.api.createNeed(this.newNeed).subscribe({
      next: () => {
        this.newNeed = { theme: '', occurrences: 1, sampleAnonymisedText: '' };
        this.cd.detectChanges();
        this.loadNeeds();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  requestDeleteNeed(id: number): void {
    if (!id) return;
    this.deleteCandidateId = id;
    this.confirmDeleteOpen = true;
  }

  cancelDelete(): void {
    this.confirmDeleteOpen = false;
    this.deleteCandidateId = null;
  }

  confirmDelete(): void {
    const id = this.deleteCandidateId;
    if (!id) return;
    this.confirmDeleteOpen = false;
    this.deleteCandidateId = null;

    this.deleteNeed(id);
  }

  private deleteNeed(id: number): void {
    this.api.deleteNeed(id).subscribe({
      next: () => {
        this.cd.detectChanges();
        this.loadNeeds();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }
}
