import { Component } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: "./login.component.html",
})
export class LoginComponent {
  email = "";
  password = "";
  errorVisible = false;

  constructor(private http: HttpClient, private router: Router) {}

  login(): void {
    this.errorVisible = false;
    this.http
      .post<{ token: string }>("http://localhost:8080/api/auth/login", {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          localStorage.setItem("insurance_auth_token", res.token);
          this.router.navigateByUrl("/wizard/step-1");
        },
        error: () => {
          this.errorVisible = true;
        },
      });
  }
}
