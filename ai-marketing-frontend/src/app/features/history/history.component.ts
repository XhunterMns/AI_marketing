import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DashboardService } from '../../core/services/dashboard.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CampaignService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { HistoryItem, CampaignResult } from '../../core/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, DatePipe, EmptyStateComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly campaignService = inject(CampaignService);
  private readonly notifications = inject(NotificationService);

  readonly items = this.dashboard.getHistory();
  readonly selectedItem = signal<HistoryItem | null>(null);

  readonly campaignData = computed(() => {
    const item = this.selectedItem();
    if (!item?.result) return null;
    return item.result as CampaignResult;
  });

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
    if (!item?.campaignId) return;
    this.campaignService.cancelCampaign(item.campaignId).subscribe({
      next: () => {
        this.notifications.success('Campaign cancelled');
        if (item.campaignId) {
          this.dashboard.removeHistoryByCampaignId(item.campaignId);
        }
        this.selectedItem.set(null);
        window.location.reload();
      },
      error: () => this.notifications.error('Failed to cancel campaign'),
    });
  }

  onDelete(item: HistoryItem): void {
    if (item.campaignId) {
      this.dashboard.removeHistoryByCampaignId(item.campaignId);
    }
    this.notifications.success('Campaign removed from history');
    this.selectedItem.set(null);
    window.location.reload();
  }
}
