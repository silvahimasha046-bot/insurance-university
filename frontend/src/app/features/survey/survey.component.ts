import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-survey",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./survey.component.html",
})
export class SurveyComponent {
  rating = 4;
  feedback = "";

  constructor(private http: HttpClient, private router: Router) {}

  submitFeedback(): void {
    this.http
      .post("http://localhost:8080/api/customer/feedback", {
        rating: this.rating,
        comments: this.feedback,
      })
      .subscribe({
        next: () => this.router.navigateByUrl("/"),
        error: () => this.router.navigateByUrl("/"),
      });
  }

  skip(): void {
    this.router.navigateByUrl("/");
  }
}
