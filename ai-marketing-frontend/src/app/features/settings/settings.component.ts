import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="page-container animate-fade-in">
      <h1 class="mb-2 text-2xl font-bold text-white">Settings</h1>
      <p class="mb-6 text-slate-400">Configure your workspace preferences.</p>
      <div class="glass-card max-w-lg p-6">
        <h2 class="mb-4 font-semibold text-white">API Configuration</h2>
        <p class="text-sm text-slate-400">
          API keys and Telegram credentials are never stored in the frontend.
          Provide Telegram Bot Token and Channel ID per campaign when needed.
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent {}
