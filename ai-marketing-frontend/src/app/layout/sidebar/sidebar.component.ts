import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input({ required: true }) collapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Campaign Generator', route: '/campaign', icon: 'campaign' },
    { label: 'Competitor Analysis', route: '/competitors', icon: 'analytics' },
    { label: 'Campaign History', route: '/history', icon: 'history' },
    { label: 'Analytics', route: '/analytics', icon: 'bar_chart' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
  ];
}
