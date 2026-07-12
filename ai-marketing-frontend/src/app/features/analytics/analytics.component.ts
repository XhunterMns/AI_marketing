import { Component } from '@angular/core';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div class="page-container animate-fade-in">
      <h1 class="mb-2 text-2xl font-bold text-white">Analytics</h1>
      <p class="mb-6 text-slate-400">Detailed performance metrics coming soon.</p>
      <app-empty-state icon="bar_chart" title="Analytics dashboard" description="Track campaign performance, engagement rates, and ROI across all channels." />
    </div>
  `,
})
export class AnalyticsComponent {}
