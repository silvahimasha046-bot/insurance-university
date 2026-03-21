import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { CustomerAuthService } from "../../../core/services/customer-auth.service";

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

  constructor(
    private http: HttpClient,
    private router: Router,
    private customerAuth: CustomerAuthService,
  ) {}

  register(): void {
    this.errorMessage = "";
    this.loading = true;
    this.http
      .post<{ token: string; name: string; email: string }>("http://localhost:8080/api/auth/register", {
        name: this.name,
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.customerAuth.storeSession(res.token, res.name, res.email);
          this.loading = false;
          this.router.navigateByUrl("/customer/dashboard");
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.error ?? "Registration failed. Please try again.";
        },
      });
  }
}