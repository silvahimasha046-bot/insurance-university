import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
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
  uploading = false;
  retrainingId: number | null = null;

  /** Last training result returned by the AI engine */
  lastTrainResult: {
    message?: string;
    rowsProcessed?: number;
    skippedRows?: number;
    updatedWeights?: Record<string, number>;
    modelArtifactId?: string;
    modelName?: string;
    trainingFormat?: string;
  } | null = null;

  trainResultDatasetName: string | null = null;
  trainError: string | null = null;
  errorMsg: string | null = null;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.loadModels();
  }

  loadDatasets(): void {
    this.api.listDatasets().subscribe({
      next: (d) => {
        this.datasets = d;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load datasets.');
        this.cd.detectChanges();
      },
    });
  }
  showError(message: string): void {
    this.errorMsg = message;
    setTimeout(() => (this.errorMsg = null), 5000);
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
        this.loadModels();
        this.handleTrainResult(res?.trainResult ?? null, filename);
        this.cd.detectChanges();
      },
      error: (error) => {
        this.uploading = false;
        this.trainError = this.buildApiErrorMessage(error as HttpErrorResponse, 'Dataset upload failed. Please try again.');
        this.cd.detectChanges();
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
        this.loadModels();
        this.handleTrainResult(res?.trainResult ?? null, dataset.originalFilename);
        this.cd.detectChanges();
      },
      error: (error) => {
        this.retrainingId = null;
        this.trainError = this.buildApiErrorMessage(error as HttpErrorResponse, 'Re-training failed. Ensure the AI engine is running.');
        this.cd.detectChanges();
      },
    });
  }

  private handleTrainResult(trainResult: any, datasetName: string): void {
    if (!trainResult) return;
    this.trainResultDatasetName = datasetName;
    this.lastTrainResult = {
      message: trainResult.message,
      rowsProcessed: trainResult.rowsProcessed,
      skippedRows: trainResult.skippedRows,
      updatedWeights: trainResult.updatedWeights ?? {},
      modelArtifactId: trainResult.modelArtifactId,
      modelName: trainResult.modelName,
      trainingFormat: trainResult.trainingFormat,
    };
  }

  get weightEntries(): { key: string; value: number }[] {
    if (!this.lastTrainResult?.updatedWeights) return [];
    return Object.entries(this.lastTrainResult.updatedWeights).map(([key, value]) => ({ key, value }));
  }

  downloadTemplate(): void {
    const header = [
      'product_code',
      'category_code',
      'subcategory_code',
      'policy_type',
      'eligibility',
      'outcome_score',
      'age',
      'smoker',
      'income',
      'monthlyExpensesLkr',
      'netWorthLkr',
      'conditions_count',
      'children_count',
      'children_ages_csv',
      'dependents',
      'protection_purpose',
      'desiredPolicyTermYears',
      'desiredSumAssured',
      'preferredPaymentMode',
    ].join(',');

    const rows = [
      'LIFE_PROT_ENDOWMENT,LIFE_INSURANCE,LIFE_PROTECTION,life,eligible,0.86,30,false,98000,43000,820000,0,1,4,1,SurvivorIncome,20,8000000,Monthly',
      'LIFE_PROT_ADVANCED_PAYMENT,LIFE_INSURANCE,LIFE_PROTECTION,life,eligible,0.82,31,false,100000,45000,840000,0,2,5|9,2,SurvivorIncome,22,9000000,Monthly',
      'LIFE_PROT_SMART_PROTECTION,LIFE_INSURANCE,LIFE_PROTECTION,life,eligible,0.93,29,false,123000,46000,1100000,0,2,3|7,2,EducationFunding,25,12000000,Quarterly',
      'LIFE_PROT_SUPREME,LIFE_INSURANCE,LIFE_PROTECTION,investment,eligible,0.74,37,false,133000,64000,1580000,1,2,8|14,2,RetirementSupplement,18,10000000,Quarterly',
      'LIFE_PROT_SAUBHAGYA,LIFE_INSURANCE,LIFE_PROTECTION,life,no offer,0.27,61,true,87000,65000,900000,2,1,18,1,SurvivorIncome,10,5000000,Yearly',
      'LIFE_EDU_SCHOLAR_PLUS,LIFE_INSURANCE,LIFE_EDUCATION,education,eligible,0.95,33,false,145000,68000,2200000,0,2,4|8,2,EducationFunding,16,15000000,Monthly',
      'LIFE_EDU_CHILD_FUTURE,LIFE_INSURANCE,LIFE_EDUCATION,education,eligible,0.94,32,false,136000,54000,1320000,0,3,2|6|10,3,EducationFunding,18,16000000,Monthly',
      'LIFE_EDU_UNIVERSITY_SECURE,LIFE_INSURANCE,LIFE_EDUCATION,education,eligible,0.96,34,false,151000,63000,1610000,1,1,3,1,EducationFunding,20,18000000,Monthly',
      'LIFE_SAV_RETIRE_PLUS,LIFE_INSURANCE,LIFE_SAVINGS,retirement,eligible,0.89,45,false,176000,97000,2540000,2,0,NONE,0,RetirementSupplement,20,12000000,Yearly',
      'LIFE_SAV_WEALTH_BUILDER,LIFE_INSURANCE,LIFE_SAVINGS,investment,eligible,0.90,43,false,157000,83000,2150000,1,0,NONE,0,EstateLiquidity,22,14000000,Monthly',
      'LIFE_SAV_MEDI_CARE_SAVER,LIFE_INSURANCE,LIFE_SAVINGS,savings,eligible,0.83,46,false,169000,94000,2460000,2,0,NONE,0,SurvivorIncome,15,10000000,Quarterly',
      'LIFE_SAV_GOLDEN_YEARS,LIFE_INSURANCE,LIFE_SAVINGS,retirement,eligible,0.88,48,false,180000,101000,2620000,2,0,NONE,0,RetirementSupplement,20,13000000,Yearly',
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

  private buildApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const err = error?.error;
    if (err && typeof err === 'object') {
      const message = typeof err.message === 'string' ? err.message : '';
      const missing = Array.isArray(err.missingColumns) ? err.missingColumns : [];
      if (message && missing.length > 0) {
        return `${message} Missing: ${missing.join(', ')}`;
      }
      if (message) {
        return message;
      }
    }
    return fallback;
  }

  loadModels(): void {
    this.api.listModels().subscribe({
      next: (m) => {
        this.models = m;
        this.cd.detectChanges();
      },
      error: () => {
        this.showError('Failed to load models.');
        this.cd.detectChanges();
      },
    });
  }

  promoteModel(id: number): void {
    this.api.promoteModel(id).subscribe({
      next: () => {
        this.cd.detectChanges();
        this.loadModels();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }
}
