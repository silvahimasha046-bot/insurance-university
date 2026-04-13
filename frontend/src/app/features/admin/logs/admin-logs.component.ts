import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../admin-api.service';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-logs.component.html',
})
export class AdminLogsComponent implements OnInit {
  logs: any[] = [];
  totalElements = 0;
  page = 0;
  size = 20;
  readonly pageSizeOptions = [10, 20, 50, 100];
  exportingFormat: 'csv' | 'json' | null = null;
  errorMsg: string | null = null;

  filters = {
    from: '',
    to: '',
    eventType: '',
    sessionHash: '',
    userSegment: '',
  };

  seeding = false;

  constructor(
    private api: AdminApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.search();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalElements / this.size));
  }

  get startItem(): number {
    return this.totalElements === 0 ? 0 : this.page * this.size + 1;
  }

  get endItem(): number {
    return Math.min((this.page + 1) * this.size, this.totalElements);
  }

  search(resetPage = false): void {
    if (resetPage) {
      this.page = 0;
    }
    const params = {
      ...this.filters,
      page: this.page,
      size: this.size,
    };
    this.api.searchLogs(params).subscribe({
      next: (res: any) => {
        this.logs = res.content ?? res;
        this.totalElements = res.totalElements ?? 0;
        if (this.page > 0 && this.logs.length === 0) {
          this.page = Math.max(this.totalPages - 1, 0);
          this.search();
          return;
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.errorMsg = 'Failed to load logs.';
        this.cd.detectChanges();
      },
    });
  }

  applyFilters(): void {
    this.search(true);
  }

  goToPreviousPage(): void {
    if (this.page === 0) return;
    this.page -= 1;
    this.search();
  }

  goToNextPage(): void {
    if (this.page + 1 >= this.totalPages) return;
    this.page += 1;
    this.search();
  }

  onPageSizeChange(): void {
    this.page = 0;
    this.search();
  }

  exportCsv(): void {
    this.exportLogs('csv');
  }

  exportJson(): void {
    this.exportLogs('json');
  }

  private exportLogs(format: 'csv' | 'json'): void {
    if (this.exportingFormat) return;
    this.errorMsg = null;
    this.exportingFormat = format;
    this.api.exportLogsFile(this.filters, format).subscribe({
      next: (response) => {
        const fallbackName = format === 'csv' ? 'logs.csv' : 'logs.json';
        const fileName = this.extractFileName(response.headers.get('content-disposition')) ?? fallbackName;
        this.triggerDownload(response.body, fileName);
        this.exportingFormat = null;
        this.cd.detectChanges();
      },
      error: () => {
        this.errorMsg = `Failed to download ${format.toUpperCase()} file.`;
        this.exportingFormat = null;
        this.cd.detectChanges();
      },
    });
  }

  private extractFileName(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1]);
    }
    const basicMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return basicMatch?.[1] ?? null;
  }

  private triggerDownload(blob: Blob | null, fileName: string): void {
    if (!blob) throw new Error('Empty download body.');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  devSeed(): void {
    this.seeding = true;
    this.api.devSeed().subscribe({
      next: () => {
        this.seeding = false;
        this.cd.detectChanges();
        this.search();
      },
      error: () => {
        this.seeding = false;
        this.cd.detectChanges();
      },
    });
  }
}
