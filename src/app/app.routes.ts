import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'chats', pathMatch: 'full' },

  {
    path: 'chats',
    children: [
      { path: '', redirectTo: 'new', pathMatch: 'full' },
      { 
        path: 'new', 
        loadComponent: () => import('./pages/new-chat/new-chat.page').then(m => m.NewChatPage) 
      },
      { 
        path: ':id', 
        loadComponent: () => import('./pages/user-chat/user-chat.page').then(m => m.UserChatPage) 
      },
    ]
  },

  { path: '**', redirectTo: 'chats' } 
];
