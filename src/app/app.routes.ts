import { Routes } from '@angular/router';
import { requireFilesGuard, requirePagesGuard } from './core/guards/flow-guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'import',
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import').then((m) => m.Import),
  },
  {
    path: 'files',
    canActivate: [requireFilesGuard],
    loadComponent: () => import('./features/files/files').then((m) => m.Files),
  },
  {
    path: 'pages',
    canActivate: [requireFilesGuard],
    loadComponent: () => import('./features/pages/pages').then((m) => m.Pages),
  },
  {
    path: 'export',
    canActivate: [requirePagesGuard],
    loadComponent: () => import('./features/export/export').then((m) => m.Export),
  },
  {
    path: '**',
    redirectTo: 'import',
  },
];
