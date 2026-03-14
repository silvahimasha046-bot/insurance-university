import { Component, OnInit } from '@angular/core';
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

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadNeeds();
  }

  loadNeeds(): void {
    this.api.listNeeds().subscribe(n => (this.needs = n));
  }

  createNeed(): void {
    this.api.createNeed(this.newNeed).subscribe(() => {
      this.newNeed = { theme: '', occurrences: 1, sampleAnonymisedText: '' };
      this.loadNeeds();
    });
  }

  deleteNeed(id: number): void {
    this.api.deleteNeed(id).subscribe(() => this.loadNeeds());
  }
}
