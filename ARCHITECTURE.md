# ARCHITECTURE.md

Документ фиксирует фактическую архитектуру `ai-chat-frontend` по состоянию исходного кода.

## 1. Технологический стек

- Angular 21, standalone-компоненты.
- TypeScript (`strict` + strict Angular template checks).
- UI: Taiga UI.
- State: `@ngrx/signals` (`signalStore`) + Angular Signals.
- Персистентность: Dexie (IndexedDB).
- Транспорт: `socket.io-client` (основной runtime-канал), HTTP fallback.
- Стили: Less.

## 2. Архитектурный стиль

Проект организован по FSD-слоям:

- `app` - bootstrap, роутинг, guard, shell-сервисы.
- `pages` - маршрутизируемые экраны.
- `widgets` - составные UI-блоки.
- `features` - пользовательские сценарии (orchestration/use-cases).
- `entities` - доменные модели, store и repository.
- `shared` - инфраструктура, конфиги, утилиты и UI-пайпы.

Правила зависимостей фиксируются в ESLint (`eslint-plugin-boundaries`):

- `app -> pages/widgets/features/entities/shared`
- `pages -> widgets/features/entities/shared`
- `widgets -> features/entities/shared`
- `features -> entities/shared`
- `entities -> shared`
- `shared` не зависит на верхние слои.

## 3. Карта репозитория

- `src/main.ts` - `bootstrapApplication(AppComponent)` + `provideHttpClient()` + `provideEventPlugins()`.
- `src/app` - `app.config.ts`, `app.routes.ts`, guard и app-level services.
- `src/pages` - `new-chat`, `user-chat`.
- `src/widgets` - `chat-header`, `chat-sidebar`, `chat-input`.
- `src/features` - `send-message`, `select-model`, `manage-chat` (включая `manage-chat/change-chat-name-modal`).
- `src/entities` - `chat`, `message`, `settings`.
- `src/shared` - `api`, `db`, `config`, `ui`, `helpers`, `validators`.
- `src/environments` - endpoint-конфиги `local/prod`.

## 4. Инициализация приложения

1. `main.ts` запускает приложение и добавляет провайдеры HTTP/Taiga plugins.
2. `app.config.ts` настраивает:

- `provideRouter(appRoutes, withComponentInputBinding())`.
- `provideAppInitializer(...)`, который вызывает `MigrationService.migrateIfNeeded()`.

3. `AppComponent` регистрирует Promise начальной загрузки:

- `SettingsStore.loadSettings()`.
- `ChatStore.loadAll()`.

4. `initialDataGuard` (`canMatch`) пропускает роуты только после готовности `AppStateService`.

## 5. Роутинг

Маршруты (`src/app/app.routes.ts`):

- `'' -> /chats`.
- `/chats -> /chats/new`.
- `/chats/new -> NewChatPage` (lazy).
- `/chats/:id -> UserChatPage` (lazy).
- `** -> /chats`.

Guard `initialDataGuard` висит на ветке `/chats`.

## 6. Слои и ответственности

### 6.1 `entities`

`chat`:

- `chat.model.ts` - типы (`Chat`, `ChatId`, `ChatState`).
- `chat.store.ts` - список чатов, activeChatId, chatsCount, upsert/remove/load.
- `chat.repository.ts` - CRUD по чатам в Dexie + каскадное удаление сообщений.

`message`:

- `message.model.ts` - типы сообщений (`ChatMessage`, роли/стейты, ids).
- `message.store.ts` - список сообщений текущего открытого чата + in-memory буфер стримящегося текста ассистента (`Map<MessageId, string>`).
- `message.repository.ts` - CRUD по сообщениям в Dexie, выборка по `[chatId+sequelId]`.

`settings`:

- `settings.model.ts` - ключи и типы настроек.
- `settings.store.ts` - `currentModel` + `globalCurrentModel`.
- `settings.repository.ts` - чтение/запись настроек в Dexie.

### 6.2 `features`

`send-message` (`SendMessageService`):

- Полный цикл отправки сообщения.
- Создает чат при первом сообщении.
- Создает user/assistant сообщения в DB и синхронно обновляет `MessageStore`.
- Запускает socket stream и обновляет chat state (`THINKING/IDLE/ERROR`).
- Пишет stream-дельты в `MessageStore` и периодически персистит их в DB (`STREAM_PERSIST_INTERVAL`) с синхронным patch в `MessageStore`.
- Поддерживает отмену одного/всех активных запросов.

`select-model` (`SelectModelService`):

- Нормализует и выбирает модель из `AVAILABLE_MODELS`.
- Синхронизирует модель между активным чатом и глобальными настройками.
- При отсутствии активного чата персистит глобальную модель.

`manage-chat` (`ManageChatService`):

- Переименование чата.
- Удаление одного чата.
- Полная очистка истории.
- Синхронизация `ChatStore` после операций.
- UI-переименование реализовано через `ChangeChatNameModalComponent` в `features/manage-chat/change-chat-name-modal`.

### 6.3 `widgets`

- `chat-header` - выбор модели, переключение sidebar.
- `chat-sidebar` - список чатов, rename/delete/clear через `ManageChatService`; переименование открывает `ChangeChatNameModalComponent`.
- `chat-input` - UI формы ввода: текст, submit по кнопке/Enter, cancel по кнопке stop; бизнес-логика отправки вынесена наружу через `@Output`.

### 6.4 `pages`

- `new-chat.page` - сбрасывает активный чат и state сообщений, восстанавливает глобальную модель, оркестрирует отправку первого сообщения через `SendMessageService` и переход в созданный чат.
- `user-chat.page`:
- активирует чат по route param;
- загружает сообщения в `MessageStore` через `MessageStore.loadByChatId(...)`;
- рендерит список из `MessageStore.messages()` (без подписки на repository events);
- обрабатывает отправку/отмену запроса из `ChatInputComponent` через `SendMessageService`;
- поддерживает retry последнего user-сообщения.

### 6.5 `app`

- `AppComponent` - root layout, resize-обсервер, инициализация базовых данных.
- `AppUiService` - состояние sidebar/mobile.
- `AppStateService` - координация guard-ready состояния.

## 7. Данные и хранилище

Dexie БД (`src/shared/db/chat.db.ts`, имя `ai-chat-db`):

- `projects` (`id`, `name`, `lastUpdate`).
- `chats` (`id`, `projectId`, `lastUpdate`).
- `messages` (`id`, `sequelId`, `chatId`, `timestamp`, `[chatId+sequelId]`).
- `settings` (`key`).

Миграция (`MigrationService`):

- Источник legacy-данных: `localStorage` ключи `ai-chat-chats`, `ai-chat-current-model`.
- Выполняется до старта навигации (через `provideAppInitializer`).
- Пропускается, если в Dexie уже есть чаты/сообщения.
- Переносит валидные записи в Dexie транзакцией и очищает legacy-ключи после успешной записи.

## 8. Сеть и протоколы

`SocketService` (`src/shared/api/socket.service.ts`) - основной runtime-канал:

- Подключение к `environment.apiUrl`, `path: /api/socket.io`.
- События:
- исходящий `chat:request`;
- входящий `chat:chunk`;
- входящий `chat:done`;
- входящий `chat:error`;
- исходящий `chat:abort`.
- Управление конкурентными запросами через `Map<requestId, Observer<string>>`.
- При `disconnect` все активные запросы завершаются ошибкой.

`HttpService` (`src/shared/api/http.service.ts`) - fallback gateway:

- `POST {apiUrl}/chat`.
- Возвращает текст первого ответа `choices[0].message.content`.
- В основном runtime-чате не используется по умолчанию.

## 9. Конфигурация

`src/shared/config/models.config.ts`:

- `ModelType`, `AVAILABLE_MODELS`.
- `HISTORY_LIMIT`.
- `SYSTEM_PROMPT`.
- `STREAM_PERSIST_INTERVAL`.

`src/shared/config/app.constants.ts`:

- `DEFAULT_CHAT_LIST_LIMIT`.

`src/environments`:

- local/dev: `apiUrl = http://localhost:5000`.
- prod: `apiUrl = https://chat.my-local-stuff.ru`.

## 10. Публичные импорты и контракты

- Alias в `tsconfig.json`: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`.
- Срезы экспортируют публичные контракты через `index.ts`.
- Предпочтительный импорт - через alias и публичные `index.ts`.

## 11. Ключевые сценарии

Отправка сообщения:

1. Пользователь отправляет текст из `ChatInputComponent`.
2. Страница (`new-chat`/`user-chat`) получает событие и вызывает `SendMessageService.sendMessage(...)`.
3. `SendMessageService.sendMessage(...)` валидирует вход и модель.
4. Для нового диалога создается чат и активируется в `ChatStore`.
5. Создаются user/assistant сообщения в `MessageRepository` и сразу upsert в `MessageStore`.
6. Стартует socket stream (`chat:request`).
7. Stream-дельты идут в `MessageStore`, затем батч-персистятся в Dexie и patch-ятся в `MessageStore`.
8. По завершению/ошибке фиксируется финальный state чата и сообщения.

Смена модели:

1. Выбор модели в `ChatHeaderComponent`.
2. `SelectModelService.selectModel(...)` нормализует модель и обновляет `SettingsStore`.
3. Если активного чата нет, модель сохраняется как глобальная настройка.

Управление историей:

1. Действия из `ChatSidebarComponent`.
2. Переименование инициируется через `ChangeChatNameModalComponent`, затем `ManageChatService` вызывает операции `rename/delete/clear` в `ChatRepository`.
3. `ChatStore` синхронизируется после каждой операции.

## 12. Ограничения и инварианты

- `pages/widgets` не работают с Dexie напрямую.
- Изменения в payload socket/HTTP и endpoint-path требуют явного запроса.
- Изменения межслойных зависимостей должны учитывать правила `eslint-plugin-boundaries`.
