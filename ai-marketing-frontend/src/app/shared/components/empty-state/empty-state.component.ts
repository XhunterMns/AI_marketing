import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-surface-2/50 px-8 py-16 text-center">
      <span class="material-icons mb-4 text-5xl text-slate-600">{{ icon }}</span>
      <h3 class="mb-2 text-lg font-semibold text-slate-200">{{ title }}</h3>
      <p class="max-w-sm text-sm text-slate-500">{{ description }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'No data yet';
  @Input() description = 'Get started by creating your first item.';
}
