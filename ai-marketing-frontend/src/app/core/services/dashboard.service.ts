import { Injectable, signal } from '@angular/core';
import { DashboardStats, ActivityItem, HistoryItem } from '../models';

const HISTORY_KEY = 'ai-marketing-history';
const STATS_KEY = 'ai-marketing-stats';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  readonly stats = signal<DashboardStats>({
    campaignsGenerated: 0,
    competitorReports: 0,
    aiRequests: 0,
    successRate: 98,
  });

  readonly recentActivity = signal<ActivityItem[]>([]);

  constructor() {
    this.loadStats();
  }

  incrementCampaigns(): void {
    this.stats.update((s) => ({
      ...s,
      campaignsGenerated: s.campaignsGenerated + 1,
      aiRequests: s.aiRequests + 1,
    }));
    this.persistStats();
  }

  incrementAnalyses(): void {
    this.stats.update((s) => ({
      ...s,
      competitorReports: s.competitorReports + 1,
      aiRequests: s.aiRequests + 1,
    }));
    this.persistStats();
  }

  addActivity(item: ActivityItem): void {
    this.recentActivity.update((items) => [item, ...items].slice(0, 10));
  }

  saveHistory(item: HistoryItem): void {
    const existing = this.getHistory();
    localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...existing].slice(0, 50)));
  }

  removeHistoryByCampaignId(campaignId: string): void {
    try {
      const existing = this.getHistory();
      const filtered = existing.filter((it) => it.campaignId !== campaignId);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    } catch {
      /* ignore */
    }
  }

  getHistory(): HistoryItem[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private loadStats(): void {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) this.stats.set(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }

  private persistStats(): void {
    localStorage.setItem(STATS_KEY, JSON.stringify(this.stats()));
  }
}
