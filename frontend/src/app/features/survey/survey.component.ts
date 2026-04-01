import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  selector: 'app-survey',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './survey.component.html',
})
export class SurveyComponent {
  stars = [1, 2, 3, 4, 5];
  rating = 4;
  feedback = '';
  submitted = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  submitFeedback(): void {
    this.http
      .post('http://localhost:8080/api/customer/feedback', {
        rating: this.rating,
        comments: this.feedback,
      })
      .subscribe({
        next: () => {
          this.cd.detectChanges();
          this.finish();
        },
        error: () => {
          this.cd.detectChanges();
          this.finish();
        },
      });
  }

  skip(): void {
    this.finish();
  }

  private finish(): void {
    this.submitted = true;
    setTimeout(() => this.router.navigateByUrl('/'), 1200);
  }
}
