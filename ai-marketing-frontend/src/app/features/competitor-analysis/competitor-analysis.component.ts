import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgClass } from '@angular/common';
import { CompetitorAnalysisService } from '../../core/services/api.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { CompetitorAnalysisResult } from '../../core/models';
import { AiThinkingLoaderComponent } from '../../shared/components/ai-thinking-loader/ai-thinking-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-competitor-analysis',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, AiThinkingLoaderComponent, EmptyStateComponent],
  templateUrl: './competitor-analysis.component.html',
  styleUrl: './competitor-analysis.component.scss',
})
export class CompetitorAnalysisComponent {
  private readonly fb = inject(FormBuilder);
  private readonly analysisService = inject(CompetitorAnalysisService);
  private readonly dashboard = inject(DashboardService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(false);
  readonly result = signal<CompetitorAnalysisResult | null>(null);

  readonly form = this.fb.nonNullable.group({
    companyName: [''],
    websiteUrl: [''],
  });

  analyze(): void {
    const { companyName, websiteUrl } = this.form.getRawValue();
    if (!companyName.trim() && !websiteUrl.trim()) {
      this.notifications.error('Enter a company name or website URL.');
      return;
    }

    const prompt = [companyName && `Company: ${companyName}`, websiteUrl && `Website: ${websiteUrl}`]
      .filter(Boolean)
      .join('\n');

    this.loading.set(true);
    this.result.set(null);

    this.analysisService.analyze({ prompt, companyName, websiteUrl }).subscribe({
      next: (res) => {
        const parsed = this.analysisService.parseResult(res);
        this.result.set(parsed);
        this.loading.set(false);
        this.dashboard.incrementAnalyses();
        this.dashboard.addActivity({
          id: crypto.randomUUID(),
          type: 'analysis',
          title: companyName || websiteUrl,
          timestamp: new Date(),
          status: 'success',
        });
        this.notifications.success('Competitor analysis complete!');
      },
      error: () => this.loading.set(false),
    });
  }

  importanceClass(level?: string): string {
    const map: Record<string, string> = {
      high: 'bg-rose-500/20 text-rose-300',
      medium: 'bg-amber-500/20 text-amber-300',
      low: 'bg-emerald-500/20 text-emerald-300',
    };
    return map[level || 'medium'] || map['medium'];
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text);
    this.notifications.info('Copied to clipboard');
  }
}
