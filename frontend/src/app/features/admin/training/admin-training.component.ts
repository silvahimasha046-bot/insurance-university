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
  retrainingId: number | null = null;

  /** Last training result returned by the AI engine */
  lastTrainResult: {
    message?: string;
    rowsProcessed?: number;
    updatedWeights?: Record<string, number>;
  } | null = null;

  trainResultDatasetName: string | null = null;
  trainError: string | null = null;

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
    this.trainError = null;
    this.lastTrainResult = null;
    const filename = this.selectedFile.name;
    this.api.uploadDataset(this.selectedFile).subscribe({
      next: (res) => {
        this.uploading = false;
        this.selectedFile = null;
        this.loadDatasets();
        this.handleTrainResult(res?.trainResult ?? null, filename);
      },
      error: () => {
        this.uploading = false;
        this.trainError = 'Dataset upload failed. Please try again.';
      },
    });
  }

  retrain(dataset: any): void {
    this.retrainingId = dataset.id;
    this.trainError = null;
    this.lastTrainResult = null;
    this.api.retrainDataset(dataset.id).subscribe({
      next: (res) => {
        this.retrainingId = null;
        this.handleTrainResult(res?.trainResult ?? null, dataset.originalFilename);
      },
      error: () => {
        this.retrainingId = null;
        this.trainError = 'Re-training failed. Ensure the AI engine is running.';
      },
    });
  }

  private handleTrainResult(trainResult: any, datasetName: string): void {
    if (!trainResult) return;
    this.trainResultDatasetName = datasetName;
    this.lastTrainResult = {
      message: trainResult.message,
      rowsProcessed: trainResult.rowsProcessed,
      updatedWeights: trainResult.updatedWeights ?? {},
    };
  }

  get weightEntries(): { key: string; value: number }[] {
    if (!this.lastTrainResult?.updatedWeights) return [];
    return Object.entries(this.lastTrainResult.updatedWeights).map(([key, value]) => ({ key, value }));
  }

  downloadTemplate(): void {
    const header = 'age,smoker,dependents,income,monthlyExpensesLkr,netWorthLkr,conditions_count,outcome_score,policy_type,eligibility';
    const rows = [
      '28,false,1,75000,35000,500000,0,0.82,term life,eligible',
      '45,true,3,120000,70000,2000000,1,0.55,investment,eligible',
      '62,false,0,80000,40000,3000000,2,0.40,retirement,eligible',
      '35,false,2,95000,50000,1000000,0,0.78,term life,eligible',
      '30,true,0,60000,45000,200000,1,0.48,term life,eligible',
    ];
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'training_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
