import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { CampaignService } from '../../core/services/api.service';
import { HistoryItem } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly campaignService = inject(CampaignService);
  readonly stats = this.dashboard.stats;
  readonly activity = this.dashboard.recentActivity;
  readonly history = signal<HistoryItem[]>([]);

  ngOnInit(): void {
    this.campaignService.getHistory().subscribe({
      next: (history) => this.history.set(history.slice(0, 5)),
      error: () => {},
    });
  }
}
