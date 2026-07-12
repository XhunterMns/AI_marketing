import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgClass } from '@angular/common';
import { debounceTime, Subscription } from 'rxjs';
import { CampaignService } from '../../core/services/api.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { CampaignRequest, CampaignResult } from '../../core/models';
import { telegramRequiredValidator } from '../../core/validators/telegram.validator';
import { AiThinkingLoaderComponent } from '../../shared/components/ai-thinking-loader/ai-thinking-loader.component';
import { ResultSectionCardComponent } from '../../shared/components/result-section-card/result-section-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

const AUTOSAVE_KEY = 'campaign-form-draft';

@Component({
  selector: 'app-campaign-generator',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgClass,
    AiThinkingLoaderComponent,
    ResultSectionCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './campaign-generator.component.html',
  styleUrl: './campaign-generator.component.scss',
})
export class CampaignGeneratorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly campaignService = inject(CampaignService);
  private readonly dashboard = inject(DashboardService);
  private readonly notifications = inject(NotificationService);

  private autosaveSub?: Subscription;

  readonly loading = signal(false);
  readonly result = signal<CampaignResult | null>(null);
  readonly lastTelegram = signal<{ botToken: string; channelId: string } | null>(null);
  readonly campaignId = signal<string>('');

  readonly tones = ['Professional', 'Friendly', 'Bold', 'Playful', 'Luxury', 'Educational'];
  readonly platforms = ['Instagram', 'LinkedIn', 'Twitter/X', 'Facebook', 'TikTok', 'Email', 'Multi-channel'];
  readonly languages = ['English', 'French', 'Arabic', 'Spanish', 'German'];
  readonly campaignTypes = ['Brand Awareness', 'Lead Generation', 'Product Launch', 'Engagement', 'Retention'];
  readonly durations = ['7 days', '14 days', '30 days', '90 days'];

  readonly form = this.fb.nonNullable.group(
    {
      businessName: ['', Validators.required],
      businessDescription: [''],
      industry: ['', Validators.required],
      targetAudience: ['', Validators.required],
      goal: ['', Validators.required],
      tone: ['Professional', Validators.required],
      language: ['English', Validators.required],
      platform: ['Instagram', Validators.required],
      campaignType: ['Brand Awareness', Validators.required],
      duration: ['14 days'],
      budget: [''],
      prompt: ['', [Validators.required, Validators.minLength(20)]],
      telegramEnabled: [false],
      telegramBotToken: [''],
      telegramChannelId: [''],
    },
    { validators: telegramRequiredValidator() }
  );

  ngOnInit(): void {
    this.loadDraft();
    this.autosaveSub = this.form.valueChanges.pipe(debounceTime(800)).subscribe(() => this.saveDraft());
  }

  ngOnDestroy(): void {
    this.autosaveSub?.unsubscribe();
  }

  generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.error('Please fill in all required fields.');
      return;
    }

    const v = this.form.getRawValue();
    const payload: CampaignRequest = {
      prompt: v.prompt,
      businessName: v.businessName,
      businessDescription: v.businessDescription,
      industry: v.industry,
      targetAudience: v.targetAudience,
      goal: v.goal,
      tone: v.tone,
      language: v.language,
      platform: v.platform,
      campaignType: v.campaignType,
      duration: v.duration,
      budget: v.budget,
      telegram: {
        enabled: v.telegramEnabled,
        botToken: v.telegramBotToken,
        channelId: v.telegramChannelId,
      },
    };

    if (v.telegramEnabled) {
      this.lastTelegram.set({ botToken: v.telegramBotToken, channelId: v.telegramChannelId });
    }

    this.loading.set(true);
    this.result.set(null);

    this.campaignService.generateCampaign(payload).subscribe({
      next: (res) => {
        const parsed = this.campaignService.parseResult(res);
        this.result.set(parsed);
        this.campaignId.set(res?.campaignId || '');
        this.loading.set(false);
        this.dashboard.incrementCampaigns();
        this.dashboard.addActivity({
          id: crypto.randomUUID(),
          type: 'campaign',
          title: parsed.title || v.businessName,
          timestamp: new Date(),
          status: 'success',
        });
        this.dashboard.saveHistory({
          id: crypto.randomUUID(),
          type: 'campaign',
          title: parsed.title || v.businessName,
          createdAt: new Date().toISOString(),
          preview: parsed.overview || parsed.strategy || v.prompt.slice(0, 120),
          campaignId: res?.campaignId || '',
          result: parsed
        });
        this.notifications.success('Campaign generated successfully!');
      },
      error: () => this.loading.set(false),
            

    });
  }

  copySection(text: string): void {
    navigator.clipboard.writeText(text);
    this.notifications.info('Copied to clipboard');
  }

  downloadPdf(): void {
    const r = this.result();
    if (!r) return;
    const content = JSON.stringify(r, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.title || 'campaign'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.notifications.info('Campaign exported');
  }

  sendSectionToTelegram(text: string): void {
    const tg = this.lastTelegram();
    if (!tg?.botToken || !tg?.channelId) {
      this.notifications.error('Enable Telegram delivery and provide credentials first.');
      return;
    }
    this.campaignService.sendToTelegram(text, tg.botToken, tg.channelId).subscribe({
      next: () => this.notifications.success('Sent to Telegram'),
      error: () => this.notifications.error('Failed to send to Telegram'),
    });
  }

  approveCampaign(): void {
    const id = this.campaignId();
    if (!id) {
      this.notifications.error('Generate a campaign first.');
      return;
    }

    this.campaignService.approveCampaign(id).subscribe({
      next: () => this.notifications.success('Campaign approved'),
      error: () => this.notifications.error('Failed to approve campaign'),
    });
  }

  declineCampaign(): void {
    const id = this.campaignId();
    if (!id) {
      this.notifications.error('Generate a campaign first.');
      return;
    }

    this.campaignService.declineCampaign(id).subscribe({
      next: () => this.notifications.success('Campaign declined'),
      error: () => this.notifications.error('Failed to decline campaign'),
    });
  }

  cancelCampaign(): void {
    const id = this.campaignId();
    if (!id) {
      this.notifications.error('Generate a campaign first.');
      return;
    }

    this.campaignService.cancelCampaign(id).subscribe({
      next: () => this.notifications.success('Campaign cancelled'),
      error: () => this.notifications.error('Failed to cancel campaign'),
    });
  }

  socialPostsText(): string {
    const posts = this.result()?.socialPosts || [];
    return posts.map((p, i) => `Post ${i + 1}${p.day ? ` (Day ${p.day})` : ''}:\n${p.content}`).join('\n\n');
  }

  calendarText(): string {
    return (this.result()?.contentCalendar || [])
      .map((c) => `Day ${c.day}: ${c.action}`)
      .join('\n');
  }

  kpisText(): string {
    return (this.result()?.kpis || [])
      .map((k) => `${k.metric}: ${k.target}`)
      .join('\n');
  }

  private saveDraft(): void {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.form.getRawValue()));
  }

  private loadDraft(): void {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) this.form.patchValue(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }
}
