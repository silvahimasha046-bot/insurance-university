import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div>
      <h1 class="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <p class="text-gray-400">Welcome to the Insurance University Admin Panel.</p>
      <div class="mt-6 grid grid-cols-2 gap-4">
        <a routerLink="/admin/products" class="block bg-gray-800 p-4 rounded hover:bg-gray-700 transition-colors">
          <div class="text-lg font-semibold">Products</div>
          <div class="text-sm text-gray-400 mt-1">Add, edit, or remove insurance products</div>
        </a>
        <a routerLink="/admin/rules" class="block bg-gray-800 p-4 rounded hover:bg-gray-700 transition-colors">
          <div class="text-lg font-semibold">Rules &amp; Pricing</div>
          <div class="text-sm text-gray-400 mt-1">Manage eligibility rules and pricing tables</div>
        </a>
        <a routerLink="/admin/training" class="block bg-gray-800 p-4 rounded hover:bg-gray-700 transition-colors">
          <div class="text-lg font-semibold">Training Data</div>
          <div class="text-sm text-gray-400 mt-1">Upload datasets and manage model versions</div>
        </a>
        <a routerLink="/admin/logs" class="block bg-gray-800 p-4 rounded hover:bg-gray-700 transition-colors">
          <div class="text-lg font-semibold">Session Logs</div>
          <div class="text-sm text-gray-400 mt-1">Search, filter and export session logs</div>
        </a>
        <a routerLink="/admin/insights" class="block bg-gray-800 p-4 rounded hover:bg-gray-700 transition-colors">
          <div class="text-lg font-semibold">Insights</div>
          <div class="text-sm text-gray-400 mt-1">View and manage unmatched needs insights</div>
        </a>
      </div>
    </div>
  `,
})
export class AdminDashboardComponent {}
