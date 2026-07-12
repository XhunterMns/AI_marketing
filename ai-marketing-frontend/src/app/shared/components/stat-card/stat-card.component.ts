import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="glass-card animate-fade-in p-5">
      <div class="mb-3 flex items-center justify-between">
        <span class="material-icons rounded-xl bg-brand/10 p-2 text-brand">{{ icon }}</span>
        @if (trend) {
          <span class="text-xs font-medium" [ngClass]="trendPositive ? 'text-emerald-400' : 'text-rose-400'">
            {{ trend }}
          </span>
        }
      </div>
      <p class="text-2xl font-bold text-white">{{ value }}</p>
      <p class="mt-1 text-sm text-slate-400">{{ label }}</p>
    </div>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) icon = 'insights';
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = 0;
  @Input() trend = '';
  @Input() trendPositive = true;
}
