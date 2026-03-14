import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminAuthService } from '../admin-auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  constructor(private auth: AdminAuthService) {}

  logout(): void {
    this.auth.logout();
  }
}
