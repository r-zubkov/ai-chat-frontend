import { Routes } from '@angular/router';
import { initialDataGuard } from './guards/initial-data.guard';

export const appRoutes: Routes = [
  { path: '', redirectTo: '/chats', pathMatch: 'full' },
  {
    path: 'chats',
    canMatch: [initialDataGuard],
    children: [
      {
        path: '',
        redirectTo: 'new',
        pathMatch: 'full',
      },
      {
        path: 'new',
        loadComponent: () => import('@pages/new-chat').then((m) => m.NewChatPage),
      },
      {
        path: ':id',
        loadComponent: () => import('@pages/user-chat').then((m) => m.UserChatPage),
      },
    ],
  },
  { path: '**', redirectTo: '/chats' },
];
