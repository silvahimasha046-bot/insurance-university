import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-training',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-training.component.html',
})
export class AdminTrainingComponent implements OnInit {
  datasets: any[] = [];
  models: any[] = [];
  selectedFile: File | null = null;
  newModel = { name: '', description: '' };
  uploading = false;

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.loadModels();
  }

  loadDatasets(): void {
    this.api.listDatasets().subscribe(d => (this.datasets = d));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  uploadDataset(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.api.uploadDataset(this.selectedFile).subscribe({
      next: () => { this.uploading = false; this.selectedFile = null; this.loadDatasets(); },
      error: () => { this.uploading = false; },
    });
  }

  loadModels(): void {
    this.api.listModels().subscribe(m => (this.models = m));
  }

  createModel(): void {
    this.api.createModel(this.newModel).subscribe(() => {
      this.newModel = { name: '', description: '' };
      this.loadModels();
    });
  }

  promoteModel(id: number): void {
    this.api.promoteModel(id).subscribe(() => this.loadModels());
  }
}
