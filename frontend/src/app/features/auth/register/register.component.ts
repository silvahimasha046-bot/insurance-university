import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./register.component.html",
})
export class RegisterComponent {
  name = "";
  email = "";
  password = "";
  errorMessage = "";
  loading = false;

  constructor(private http: HttpClient, private router: Router) {}

  register(): void {
    this.errorMessage = "";
    this.loading = true;
    this.http
      .post<{ token: string; name: string }>("http://localhost:8080/api/auth/register", {
        name: this.name,
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          localStorage.setItem("insurance_auth_token", res.token);
          this.loading = false;
          this.router.navigateByUrl("/wizard/step-1");
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.error ?? "Registration failed. Please try again.";
        },
      });
  }
}