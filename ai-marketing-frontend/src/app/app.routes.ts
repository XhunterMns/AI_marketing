import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
    {
        path: 'generate-content',
        loadComponent: () =>
          import('./generate-content/generate-content.component').then(
            (m) => m.GenerateContentComponent
          ),
      
    },
      {
        path: 'campaign',
        loadComponent: () =>
          import('./features/campaign-generator/campaign-generator.component').then(
            (m) => m.CampaignGeneratorComponent
          ),
      },
      {
        path: 'competitors',
        loadComponent: () =>
          import('./features/competitor-analysis/competitor-analysis.component').then(
            (m) => m.CompetitorAnalysisComponent
          ),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.component').then((m) => m.HistoryComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
