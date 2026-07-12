import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  templateUrl: './top-nav.component.html',
  styleUrl: './top-nav.component.scss',
})
export class TopNavComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly breadcrumbs = this.buildBreadcrumbs();

  private buildBreadcrumbs(): { label: string; path: string }[] {
    const url = this.router.url.split('?')[0];
    const map: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/campaign': 'Campaign Generator',
      '/competitors': 'Competitor Analysis',
      '/history': 'Campaign History',
      '/analytics': 'Analytics',
      '/settings': 'Settings',
    };
    const label = map[url] || 'Dashboard';
    return [
      { label: 'Home', path: '/dashboard' },
      { label, path: url },
    ];
  }
}
