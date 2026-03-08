# Angular FSD Style Guide

> Общий справочник по Feature-Sliced Design для Angular 21+ Standalone Components.
> Не привязан к конкретному проекту — это живой стайлгайд с паттернами и антипаттернами.

---

## Содержание

1. [Основы FSD](#1-основы-fsd)
2. [Слои и их ответственность](#2-слои-и-их-ответственность)
3. [Слайсы и публичный API](#3-слайсы-и-публичный-api)
4. [Правила импортов](#4-правила-импортов)
5. [Состояние: @ngrx/signals](#5-состояние-ngrxsignals)
6. [Dependency Injection в Angular FSD](#6-dependency-injection-в-angular-fsd)
7. [Роутинг](#7-роутинг)
8. [Типизация и модели](#8-типизация-и-модели)
9. [Shared: что туда идёт, а что нет](#9-shared-что-туда-идёт-а-что-нет)
10. [Антипаттерны](#10-антипаттерны)
11. [Шпаргалки](#11-шпаргалки)

---

## 1. Основы FSD

Feature-Sliced Design — методология, основанная на двух осях:

- **Горизонталь** — слои (layers): жёсткая иерархия, импорт только вниз
- **Вертикаль** — слайсы (slices): изоляция по доменному признаку

```
┌─────────────────────────────────────────────────────┐
│  app      — инициализация, роутинг, shell           │
├─────────────────────────────────────────────────────┤
│  pages    — роутируемые экраны                      │
├─────────────────────────────────────────────────────┤
│  widgets  — составные UI-блоки                      │
├─────────────────────────────────────────────────────┤
│  features — пользовательские сценарии               │
├─────────────────────────────────────────────────────┤
│  entities — доменные модели и состояние             │
├─────────────────────────────────────────────────────┤
│  shared   — утилиты, UI-kit, транспорт, конфиг      │
└─────────────────────────────────────────────────────┘
         импорт только ↓, никогда ↑
```

### Три главных принципа

1. **Иерархия импортов** — слой может импортировать только слои ниже себя.
2. **Изоляция слайсов** — слайсы одного слоя не импортируют друг друга.
3. **Публичный API** — всё общение между слайсами только через `index.ts`.

---

## 2. Слои и их ответственность

### `app/`

Единственное место в проекте, где живёт глобальная инициализация.

**Что здесь:**

- `app.component.*` — корневой shell-layout
- `app.config.ts` — провайдеры Angular (`provideRouter`, `provideHttpClient`, etc.)
- `app.routes.ts` — корневые маршруты
- Guards, относящиеся к жизненному циклу приложения
- Сервисы уровня shell (UI-состояние, app-ready state)

**Чего здесь нет:**

- Бизнес-логики
- Обращений к API
- Доменных моделей

```ts
// ✅ app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes), provideHttpClient(withFetch()), provideAnimations()],
};
```

---

### `pages/`

Роутируемые экраны. Каждая страница — отдельный standalone-компонент.

**Что здесь:**

- Один компонент на страницу
- Компоновка виджетов и фич на экране
- Инжект entity-сторов и feature-сервисов
- Реакция на route params через `ActivatedRoute`

**Чего здесь нет:**

- Бизнес-логики
- Прямых вызовов репозиториев или API
- Переиспользуемых компонентов (это widgets)

```ts
// ✅ pages/user-profile/user-profile.page.ts
@Component({
  standalone: true,
  imports: [ProfileCardWidget, EditProfileFeature],
  template: `
    <app-profile-card [user]="userStore.activeUser()" />
    <app-edit-profile />
  `,
})
export class UserProfilePage {
  readonly userStore = inject(UserStore);
}
```

---

### `widgets/`

Составные UI-блоки. Достаточно умные, чтобы инжектить сторы, но не знают о бизнес-сценариях.

**Что здесь:**

- Сложная разметка и стили
- Инжект entity-сторов (только чтение)
- `@Input()` / `@Output()` для конфигурации извне
- Вызов feature-сервисов по событиям пользователя

**Чего здесь нет:**

- Бизнес-логики (создать/удалить/отправить — это features)
- Знания о конкретной странице
- Прямых вызовов HTTP/socket

```ts
// ✅ widgets/user-list/user-list.component.ts
@Component({
  standalone: true,
  template: `
    @for (user of userStore.users(); track user.id) {
      <app-user-card [user]="user" (select)="onSelect(user)" />
    }
  `,
})
export class UserListComponent {
  readonly userStore = inject(UserStore);
  readonly selectUser = inject(SelectUserService);

  onSelect(user: User) {
    this.selectUser.execute(user.id);
  }
}
```

---

### `features/`

Пользовательские сценарии. Один слайс = один use-case.

**Что здесь:**

- Сервис с методом, выполняющим сценарий от начала до конца
- Компоненты, специфичные только для этого сценария (модалки, формы)
- Оркестрация: вызов репозиториев, стором, транспортом

**Чего здесь нет:**

- Глобального состояния (это entities)
- Переиспользуемого UI (это widgets)
- Нескольких несвязанных сценариев в одном слайсе

```ts
// ✅ features/delete-user/delete-user.service.ts
@Injectable({ providedIn: 'root' })
export class DeleteUserService {
  private readonly userRepository = inject(UserRepository);
  private readonly userStore = inject(UserStore);
  private readonly router = inject(Router);

  async execute(userId: UserId): Promise<void> {
    await this.userRepository.delete(userId);
    this.userStore.removeUser(userId);
    await this.router.navigate(['/users']);
  }
}
```

---

### `entities/`

Доменное ядро. Модели, состояние, персистенция.

**Что здесь:**

- `*.model.ts` — типы, интерфейсы, enums
- `*.store.ts` — @ngrx/signals signalStore
- `*.repository.ts` — CRUD, event streams
- `index.ts` — публичный API

**Чего здесь нет:**

- Пользовательских сценариев (это features)
- UI-компонентов
- Знания о других entities (можно импортировать только `model.ts` соседей)

```ts
// ✅ entities/user/user.store.ts
export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>({ users: [], activeUserId: null }),
  withComputed(({ users, activeUserId }) => ({
    activeUser: computed(() => users().find((u) => u.id === activeUserId()) ?? null),
  })),
  withMethods((store, userRepository = inject(UserRepository)) => ({
    async loadAll() {
      patchState(store, { users: await userRepository.getAll() });
    },
    removeUser(id: UserId) {
      patchState(store, { users: store.users().filter((u) => u.id !== id) });
    },
  })),
);
```

---

### `shared/`

Всё, что переиспользуется без знания о домене.

**Что здесь:**

- UI-примитивы (кнопки, инпуты без бизнес-логики)
- HTTP/socket клиенты (транспорт)
- Утилиты (форматирование, валидаторы, хелперы)
- Конфиги и константы уровня приложения
- Dexie/IndexedDB схема

**Чего здесь нет:**

- Импортов из `entities/`, `features/`, `widgets/`, `pages/`, `app/`
- Доменной логики
- Состояния

---

## 3. Слайсы и публичный API

### Структура слайса

Каждый слайс — папка с файлами и обязательным `index.ts`.

```
features/
  send-message/
    send-message.service.ts   ← реализация (приватная)
    send-message.types.ts     ← внутренние типы (приватные)
    index.ts                  ← публичный API
```

### Правило `index.ts`

`index.ts` — единственная «дверь» в слайс. Снаружи виден только то, что явно экспортировано.

```ts
// ✅ features/send-message/index.ts
export { SendMessageService } from './send-message.service';
// SendMessageTypes — не экспортируем, это внутренний контракт
```

### Импорт через barrel

```ts
// ✅ правильно — через index.ts
import { SendMessageService } from '@features/send-message';
import { UserStore, User } from '@entities/user';

// ❌ неправильно — прямой импорт внутреннего файла
import { SendMessageService } from '@features/send-message/send-message.service';
import { UserStore } from '@entities/user/user.store';
```

---

## 4. Правила импортов

### Таблица разрешённых импортов

| Слой       | Может импортировать                            |
| ---------- | ---------------------------------------------- |
| `app`      | pages · widgets · features · entities · shared |
| `pages`    | widgets · features · entities · shared         |
| `widgets`  | features · entities · shared                   |
| `features` | entities · shared                              |
| `entities` | shared · (model.ts других entities)            |
| `shared`   | —                                              |

### Импорт между слайсами одного слоя

Слайсы одного слоя изолированы друг от друга.

```ts
// ❌ features/send-message/send-message.service.ts
import { SelectModelService } from '@features/select-model'; // нельзя!

// ✅ правильно — если нужен результат из другой фичи,
//    читай состояние через entity store
import { SettingsStore } from '@entities/settings';

@Injectable({ providedIn: 'root' })
export class SendMessageService {
  private readonly settings = inject(SettingsStore);

  execute(text: string) {
    const model = this.settings.currentModel(); // читаем из стора, не из другой фичи
    // ...
  }
}
```

### Исключение для entities

`entities` могут импортировать `model.ts` других `entities`, но **не** их store или repository.

```ts
// ✅ entities/message/message.model.ts
import type { ChatId } from '@entities/chat'; // можно — только тип

// ❌ entities/message/message.repository.ts
import { ChatStore } from '@entities/chat'; // нельзя — это store, не model
```

### tsconfig paths

```json
{
  "compilerOptions": {
    "paths": {
      "@app/*": ["src/app/*"],
      "@pages/*": ["src/pages/*"],
      "@widgets/*": ["src/widgets/*"],
      "@features/*": ["src/features/*"],
      "@entities/*": ["src/entities/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

---

## 5. Состояние: @ngrx/signals

### signalStore — единственное хранилище

В Angular FSD состояние живёт в `entities/*/store.ts`.
Используй `signalStore` из `@ngrx/signals`.

### Полный шаблон store

```ts
// entities/order/order.store.ts
import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { OrderRepository } from './order.repository';
import type { Order, OrderId, OrderState } from './order.model';

export const OrderStore = signalStore(
  { providedIn: 'root' },

  withState<OrderState>({
    orders: [] as Order[],
    activeOrderId: null as OrderId | null,
    isLoading: false,
  }),

  withComputed(({ orders, activeOrderId }) => ({
    activeOrder: computed(() => orders().find((o) => o.id === activeOrderId()) ?? null),
    ordersCount: computed(() => orders().length),
    pendingOrders: computed(() => orders().filter((o) => o.status === 'PENDING')),
  })),

  withMethods((store, orderRepository = inject(OrderRepository)) => ({
    // Асинхронные методы — загрузка
    async loadAll(): Promise<void> {
      patchState(store, { isLoading: true });
      const orders = await orderRepository.getAll();
      patchState(store, { orders, isLoading: false });
    },

    // Синхронные методы — обновление состояния
    setActive(id: OrderId): void {
      patchState(store, { activeOrderId: id });
    },

    upsertOrder(order: Order): void {
      const exists = store.orders().some((o) => o.id === order.id);
      patchState(store, {
        orders: exists
          ? store.orders().map((o) => (o.id === order.id ? order : o))
          : [...store.orders(), order],
      });
    },

    removeOrder(id: OrderId): void {
      patchState(store, { orders: store.orders().filter((o) => o.id !== id) });
    },
  })),
);
```

### Паттерн optimistic update

```ts
// ✅ features/complete-order/complete-order.service.ts
@Injectable({ providedIn: 'root' })
export class CompleteOrderService {
  private readonly orderStore = inject(OrderStore);
  private readonly orderRepository = inject(OrderRepository);

  async execute(orderId: OrderId): Promise<void> {
    // 1. Optimistic update — UI реагирует мгновенно
    this.orderStore.upsertOrder({ ...this.orderStore.activeOrder()!, status: 'COMPLETED' });

    try {
      // 2. Персистенция
      await this.orderRepository.update(orderId, { status: 'COMPLETED' });
    } catch {
      // 3. Rollback при ошибке
      this.orderStore.upsertOrder({ ...this.orderStore.activeOrder()!, status: 'PENDING' });
    }
  }
}
```

### Чтение сигналов в шаблоне

```ts
// ✅ правильно — используй сигналы напрямую в шаблоне
@Component({
  template: `
    <span>{{ orderStore.ordersCount() }}</span>

    @if (orderStore.activeOrder(); as order) {
      <h1>{{ order.title }}</h1>
    }

    @for (order of orderStore.pendingOrders(); track order.id) {
      <app-order-card [order]="order" />
    }
  `,
})
export class OrdersPage {
  readonly orderStore = inject(OrderStore);
}
```

---

## 6. Dependency Injection в Angular FSD

### inject() вместо constructor DI

В Angular 21+ используй функциональный `inject()`. Он работает везде, где есть injection context.

```ts
// ✅ современный стиль
@Component({ standalone: true, ... })
export class MyComponent {
  private readonly userStore   = inject(UserStore);
  private readonly sendMessage = inject(SendMessageService);
  private readonly router      = inject(Router);
}

// ❌ устаревший стиль (допустим, но verbose)
@Component({ standalone: true, ... })
export class MyComponent {
  constructor(
    private readonly userStore: UserStore,
    private readonly sendMessage: SendMessageService,
    private readonly router: Router,
  ) {}
}
```

### Уровни providedIn

| Уровень                         | Когда использовать                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `providedIn: 'root'`            | Entity stores, shared services, feature services без состояния                      |
| `providers: [...]` в компоненте | Feature-специфичные сервисы с состоянием, привязанным к жизненному циклу компонента |
| `providers: [...]` в route      | Сервисы, живущие только пока активен route                                          |

```ts
// ✅ entity store — всегда root, данные должны переживать навигацию
export const UserStore = signalStore({ providedIn: 'root' }, ...);

// ✅ feature service — root, потому что нет state
@Injectable({ providedIn: 'root' })
export class DeleteUserService { ... }

// ✅ feature service с состоянием — scope к роуту
// pages/checkout/checkout.routes.ts
export const checkoutRoutes: Route[] = [{
  path: '',
  component: CheckoutPage,
  providers: [CheckoutFlowService], // живёт только на этом роуте
}];
```

### Нет God-сервису (фасаду над фасадами)

```ts
// ❌ антипаттерн — фасад, делегирующий в 5 других сервисов
@Injectable({ providedIn: 'root' })
export class AppFacadeService {
  constructor(
    private userFacade: UserFacadeService,
    private orderFacade: OrderFacadeService,
    private settingsFacade: SettingsFacadeService,
  ) {}

  getActiveUser()  { return this.userFacade.getActive(); }
  getOrders()      { return this.orderFacade.getAll(); }
  // ...30 методов-прокси
}

// ✅ правильно — инжектим напрямую то, что нужно
@Component({ standalone: true, ... })
export class DashboardPage {
  readonly userStore  = inject(UserStore);
  readonly orderStore = inject(OrderStore);
}
```

---

## 7. Роутинг

### Lazy-load по слайсам

Каждая страница грузится лениво. Роуты описываются в `app/app.routes.ts`.

```ts
// ✅ app/app.routes.ts
export const appRoutes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('@pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'users',
    canActivate: [AuthGuard],
    loadComponent: () => import('@pages/users/users.page').then((m) => m.UsersPage),
  },
  {
    path: 'users/:id',
    loadComponent: () =>
      import('@pages/user-detail/user-detail.page').then((m) => m.UserDetailPage),
  },
];
```

### Route-level providers

```ts
// ✅ если фиче нужен scoped-сервис — провайдь его на уровне роута
{
  path: 'checkout',
  loadComponent: () => import('@pages/checkout/checkout.page').then(m => m.CheckoutPage),
  providers: [CheckoutFlowService],
}
```

### Guards в app/

Guards живут в `app/guards/`. Они не должны содержать бизнес-логику — только проверку готовности/доступа.

```ts
// ✅ app/guards/auth.guard.ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};
```

---

## 8. Типизация и модели

### Где живут типы

| Тип                                          | Место                                       |
| -------------------------------------------- | ------------------------------------------- |
| Доменная сущность (User, Order)              | `entities/*/model.ts`                       |
| Состояние стора (UserState)                  | `entities/*/model.ts`                       |
| Контракты внешнего API (HTTP/socket payload) | `shared/api/*.model.ts`                     |
| Enum моделей, конфиги                        | `shared/config/*.ts`                        |
| Локальные типы компонента                    | рядом с компонентом или в `model.ts` слайса |

### Паттерн branded types для ID

```ts
// ✅ entities/user/user.model.ts
export type UserId = string & { readonly __brand: 'UserId' };

export function toUserId(raw: string): UserId {
  return raw as UserId;
}

export interface User {
  id: UserId;
  name: string;
  email: string;
  createdAt: number;
}

export interface UserState {
  users: User[];
  activeUserId: UserId | null;
  isLoading: boolean;
}
```

### Не смешивай доменные типы и транспортные контракты

```ts
// ❌ неправильно — payload и доменная модель в одном файле
// entities/message/message.model.ts
export interface Message { ... }      // доменная модель
export interface MessagePayload { ... } // socket-контракт — сюда не относится

// ✅ правильно — раздели
// entities/message/message.model.ts → только доменные типы
// shared/api/message-payload.model.ts → только транспортные контракты
```

---

## 9. Shared: что туда идёт, а что нет

### Структура shared/

```
shared/
  api/          ← HTTP/socket клиенты и их payload-контракты
  db/           ← схема БД, миграции
  config/       ← константы и конфиги уровня приложения
  ui/           ← переиспользуемые компоненты без домена (Button, Input, Modal)
  helpers/      ← чистые утилиты (форматирование, хеши, конвертеры)
  validators/   ← Angular validators
```

### Правило shared/ui

Компоненты в `shared/ui/` — немые. Они не знают ни о каком домене.

```ts
// ✅ shared/ui/button/button.component.ts
@Component({
  standalone: true,
  selector: 'app-button',
  template: `<button [class]="variant()" (click)="clicked.emit()"><ng-content /></button>`,
})
export class ButtonComponent {
  variant = input<'primary' | 'secondary' | 'danger'>('primary');
  clicked = output<void>();
}

// ❌ нельзя в shared/ui — знает о домене
@Component({ ... })
export class DeleteUserButtonComponent {
  readonly deleteUser = inject(DeleteUserService); // домен в shared — нарушение!
}
```

### Что НЕ идёт в shared/

```
❌  Компоненты, которые инжектят entity-сторы          → widgets/
❌  Сервисы, реализующие пользовательский сценарий     → features/
❌  Доменные модели (User, Order, Message)             → entities/
❌  Состояние приложения                               → entities/
❌  Роутинг-логика                                     → app/ или pages/
```

---

## 10. Антипаттерны

### ❌ Монослайс — вся фича в одной папке

```
// ❌ типичная ошибка при росте
features/
  chat/
    components/      ← 12 компонентов
    services/        ← 8 сервисов
    store/
    types/
    helpers/
    constants/
    pipes/
    pages/

// ✅ правильно — разбить по слоям FSD
pages/     new-chat/, user-chat/
widgets/   chat-sidebar/, chat-header/, chat-input/
features/  send-message/, manage-chat/, select-model/
entities/  chat/, message/, settings/
shared/    api/, config/, ui/markdown/
```

---

### ❌ Фасад над фасадами (God Service)

```ts
// ❌ ChatFacadeService делегирует в 3 других фасада
export class ChatFacadeService {
  sendMessage(text: string) {
    return this.conversationFacade.send(text); // зачем прокси?
  }
  getChats() {
    return this.chatsFacade.getAll(); // ещё один уровень косвенности
  }
}

// ✅ inject напрямую в компонент/страницу
export class UserChatPage {
  readonly chatStore = inject(ChatStore);
  readonly sendMessage = inject(SendMessageService);
}
```

---

### ❌ Отдельный mutation.service рядом со store

```ts
// ❌ лишний уровень — mutation.service как прокси над store
// domain/chats/mutation.service.ts
export class ChatsMutationService {
  addChat(chat: Chat) {
    this.store.add(chat);
  } // зачем?
  removeChat(id: Id) {
    this.store.remove(id);
  } // зачем?
}

// ✅ мутации живут внутри signalStore в withMethods
export const ChatStore = signalStore(
  withMethods((store) => ({
    addChat: (chat: Chat) => patchState(store, { chats: [...store.chats(), chat] }),
    removeChat: (id: Id) => patchState(store, { chats: store.chats().filter((c) => c.id !== id) }),
  })),
);
```

---

### ❌ Прямой импорт внутреннего файла чужого слайса

```ts
// ❌ обход инкапсуляции
import { ChatStore } from '@entities/chat/chat.store'; // прямой путь
import { UserRepository } from '@entities/user/user.repository'; // прямой путь

// ✅ только через index.ts
import { ChatStore } from '@entities/chat';
import { UserRepository } from '@entities/user';
```

---

### ❌ Слайсы одного слоя импортируют друг друга

```ts
// ❌ features/send-message → features/select-model — нарушение изоляции
import { SelectModelService } from '@features/select-model';

// ✅ читай общее состояние через entities
import { SettingsStore } from '@entities/settings';

const model = inject(SettingsStore).currentModel();
```

---

### ❌ Бизнес-логика в компоненте

```ts
// ❌ компонент сам решает, как удалить пользователя
@Component({ ... })
export class UserCardComponent {
  async deleteUser(id: UserId) {
    await this.http.delete(`/users/${id}`).toPromise(); // HTTP в компоненте!
    this.users = this.users.filter(u => u.id !== id);  // мутация локального массива!
    this.router.navigate(['/users']);
  }
}

// ✅ компонент делегирует в feature-сервис
@Component({ ... })
export class UserCardComponent {
  private readonly deleteUser = inject(DeleteUserService);

  onDelete(id: UserId) {
    this.deleteUser.execute(id); // вся логика в сервисе
  }
}
```

---

### ❌ shared/ импортирует из entities/

```ts
// ❌ shared нарушает иерархию
// shared/ui/user-avatar/user-avatar.component.ts
import { UserStore } from '@entities/user'; // нельзя!

// ✅ передавай данные через @Input()
@Component({
  selector: 'app-user-avatar',
  template: `<img [src]="avatarUrl()" />`,
})
export class UserAvatarComponent {
  avatarUrl = input.required<string>(); // данные приходят снаружи
}
```

---

### ❌ Типы в неправильном месте

```ts
// ❌ конфиг моделей внутри фичи
// features/chat/constants/chat.constants.ts
export const AVAILABLE_MODELS = ['gpt-4', 'claude-3']; // конфиг уровня app, не фичи

// ✅ конфиг в shared
// shared/config/models.config.ts
export const AVAILABLE_MODELS: ModelOption[] = [
  { key: ModelType.GPT4, label: 'GPT-4' },
  { key: ModelType.CLAUDE3, label: 'Claude 3' },
];
```

---

### ❌ Один репозиторий на все сущности

```ts
// ❌ God-репозиторий нарушает SRP
export class AppRepository {
  getChats()    { ... }
  getMessages() { ... }
  getSettings() { ... }
  getUsers()    { ... }
}

// ✅ каждая сущность — свой репозиторий
// entities/chat/chat.repository.ts
// entities/message/message.repository.ts
// entities/settings/settings.repository.ts
```

---

## 11. Шпаргалки

### Куда положить новый файл

| Что создаю                         | Слой        | Пример                          |
| ---------------------------------- | ----------- | ------------------------------- |
| Роутируемый экран                  | `pages/`    | `pages/order-detail/`           |
| Переиспользуемый блок с UI         | `widgets/`  | `widgets/order-card/`           |
| Действие пользователя              | `features/` | `features/cancel-order/`        |
| Доменная модель / состояние / CRUD | `entities/` | `entities/order/`               |
| Утилита / транспорт / конфиг       | `shared/`   | `shared/helpers/format-date.ts` |
| Провайдеры / роутинг / shell       | `app/`      | `app/app.config.ts`             |

---

### Чеклист нового слайса

```
□ Создана папка в правильном слое
□ Есть index.ts с публичным API
□ Нет импортов из слоёв выше
□ Нет импортов из слайсов того же слоя (кроме model.ts в entities)
□ Логика разделена по сегментам (model / store / repository / service / component)
□ providedIn уровень выбран осознанно
□ Нет бизнес-логики в компонентах
□ Нет прямых HTTP/socket вызовов вне shared/api
```

---

### Направление импортов — быстрая проверка

```
Если файл в features/ импортирует из pages/   → ❌ нарушение
Если файл в entities/ импортирует из features/ → ❌ нарушение
Если файл в shared/ импортирует из entities/   → ❌ нарушение
Если файл в widgets/ импортирует из features/  → ✅ допустимо
Если файл в pages/ импортирует из entities/    → ✅ допустимо
Если файл в features/ импортирует из shared/   → ✅ допустимо
```

---

### Дерево решений для store vs service

```
Нужно ли хранить состояние между навигациями?
  ├─ Да → signalStore в entities/, providedIn: 'root'
  └─ Нет
       ├─ Это один пользовательский сценарий?
       │    ├─ Да → Injectable сервис в features/
       │    └─ Нет → разбей на несколько features/
       └─ Это только производные данные (computed)?
            └─ Да → withComputed внутри существующего store
```
