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

  search(): void {
    const params = {
      ...this.filters,
      page: this.page,
      size: this.size,
    };
    this.api.searchLogs(params).subscribe({
      next: (res: any) => {
        this.logs = res.content ?? res;
        this.totalElements = res.totalElements ?? 0;
        this.cd.detectChanges();
      },
      error: () => {
        this.cd.detectChanges();
      },
    });
  }

  exportCsv(): void {
    window.open(this.api.exportLogs(this.filters, 'csv'), '_blank');
  }

  exportJson(): void {
    window.open(this.api.exportLogs(this.filters, 'json'), '_blank');
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
