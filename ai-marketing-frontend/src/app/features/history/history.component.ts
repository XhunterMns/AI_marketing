import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HistoryItem, CampaignResult } from '../../core/models';
import { CampaignService } from '../../core/services/api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, DatePipe, EmptyStateComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent implements OnInit {
  private readonly campaignService = inject(CampaignService);
  private readonly notifications = inject(NotificationService);

  readonly items = signal<HistoryItem[]>([]);
  readonly loading = signal(false);
  readonly selectedItem = signal<HistoryItem | null>(null);

  readonly campaignData = computed(() => {
    const item = this.selectedItem();
    if (!item?.result) return null;
    return item.result as CampaignResult;
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.campaignService.getHistory().subscribe({
      next: (history) => this.items.set(history),
      error: () => this.notifications.error('Failed to load campaign history'),
      complete: () => this.loading.set(false),
    });
  }

  onShowDetails(item: HistoryItem): void {
    this.selectedItem.set(item);
  }

  onResend(item: HistoryItem): void {
    if (!item?.campaignId) return;
    this.campaignService.approveCampaign(item.campaignId).subscribe({
      next: () => {
        this.notifications.success('Campaign resent and approved');
        this.selectedItem.set(null);
      },
      error: () => this.notifications.error('Failed to resend campaign'),
    });
  }

  onCancel(item: HistoryItem): void {
    const campaignId = item?.campaignId;
    if (!campaignId) return;
    this.campaignService.cancelCampaign(campaignId).subscribe({
      next: () => {
        this.campaignService.deleteHistoryItem(campaignId).subscribe({
          next: () => {
            this.notifications.success('Campaign cancelled');
            this.deleteHistoryEntry(campaignId);
            this.selectedItem.set(null);
          },
          error: () => this.notifications.error('Campaign cancelled, but failed to update history'),
        });
      },
      error: () => this.notifications.error('Failed to cancel campaign'),
    });
  }

  onDelete(item: HistoryItem): void {
    const campaignId = item?.campaignId;
    if (!campaignId) return;
    this.campaignService.deleteHistoryItem(campaignId).subscribe({
      next: () => {
        this.notifications.success('Campaign removed from history');
        this.deleteHistoryEntry(campaignId);
        this.selectedItem.set(null);
      },
      error: () => this.notifications.error('Failed to remove campaign from history'),
    });
  }

  private deleteHistoryEntry(campaignId: string): void {
    this.items.update((items) => items.filter((item) => item.campaignId !== campaignId));
  }
}
