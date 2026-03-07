# ARCHITECTURE

Документ фиксирует текущую архитектуру `ai-chat-frontend` по фактическому состоянию кода.

## 1. Технологический стек

- Angular 21, standalone-компоненты.
- TypeScript `strict`.
- UI: Taiga UI.
- State: `@ngrx/signals` (`signalStore`) + Angular Signals.
- Персистентность: Dexie (IndexedDB).
- Транспорт: `socket.io-client` (основной), HTTP fallback (резервный).
- Стили: Less.

## 2. Архитектурный стиль

Проект организован по FSD-слоям:

- `app` - инициализация приложения, роутинг, shell-сервисы.
- `pages` - маршрутизируемые экраны.
- `widgets` - составные UI-блоки.
- `features` - пользовательские сценарии (use-cases).
- `entities` - доменные модели, store и repository.
- `shared` - инфраструктура и переиспользуемые утилиты.

Ограничения зависимостей зафиксированы в ESLint (`eslint-plugin-boundaries`):

- `app -> pages/widgets/features/entities/shared`
- `pages -> widgets/features/entities/shared`
- `widgets -> features/entities/shared`
- `features -> entities/shared`
- `entities -> shared`
- `shared -> (нет зависимостей на верхние слои)`

## 3. Карта репозитория

- `src/app` - root shell (`AppComponent`), `app.routes.ts`, `app.config.ts`, guard, app-level services.
- `src/pages` - `new-chat`, `user-chat`.
- `src/widgets` - `chat-header`, `chat-sidebar`, `chat-input`.
- `src/features` - `send-message`, `select-model`, `manage-chat`.
- `src/entities` - `chat`, `message`, `settings`.
- `src/shared` - `api`, `db`, `config`, `ui`, `helpers`, `validators`.
- `src/environments` - endpoint-конфиги для local/prod.

## 4. Инициализация и жизненный цикл

1. `main.ts` запускает `bootstrapApplication(AppComponent)` и подключает:

- `appConfig`
- `provideHttpClient()`
- `provideEventPlugins()`

2. `app.config.ts` задает:

- `provideRouter(appRoutes, withComponentInputBinding())`
- `provideAppInitializer(...)`, который вызывает `MigrationService.migrateIfNeeded()`

3. `AppComponent` в конструкторе регистрирует промис начальной загрузки:

- `SettingsStore.loadSettings()`
- `ChatStore.loadAll()`

4. `initialDataGuard` пропускает роуты только после завершения этой загрузки через `AppStateService`.

## 5. Роутинг

- `'' -> /chats`
- `/chats/new -> NewChatPage` (lazy)
- `/chats/:id -> UserChatPage` (lazy)
- `** -> /chats`

Guard `canMatch` применяется на ветке `/chats`.

## 6. Слои и ответственности

## 6.1 `entities`

`chat`:

- `chat.model.ts` - типы (`Chat`, `ChatId`, `ChatState`).
- `chat.store.ts` - список чатов, активный чат, upsert/remove/load.
- `chat.repository.ts` - CRUD по чатам в Dexie, `chatsUpdated$`.

`message`:

- `message.model.ts` - типы сообщений (`ChatMessage`, `MessageId`, `SequelId`, role/state).
- `message.store.ts` - in-memory контент стримящегося ассистент-сообщения (`Map<MessageId, string>`).
- `message.repository.ts` - CRUD по сообщениям в Dexie, `messagesUpdated$`.

`settings`:

- `settings.model.ts` - ключи и типы настроек.
- `settings.store.ts` - `currentModel` и `globalCurrentModel`.
- `settings.repository.ts` - чтение/запись настроек в Dexie.

## 6.2 `features`

`send-message`:

- Оркестрация полного цикла отправки сообщения.
- Создает чат при первом сообщении.
- Создает user/assistant сообщения.
- Запускает socket stream.
- Пишет стрим-дельты в `MessageStore`.
- Периодически персистит стрим в DB (`STREAM_PERSIST_INTERVAL`).
- Обновляет состояние чата (`IDLE/THINKING/ERROR`), поддерживает abort/destroy.

`select-model`:

- Выбор и нормализация модели.
- Синхронизация `SettingsStore` для нового/активного чата.
- Сохранение глобальной модели в настройках при работе вне активного чата.

`manage-chat`:

- Переименование чата.
- Удаление одного чата.
- Очистка всей истории.
- Синхронизация `ChatStore` после операций.

## 6.3 `widgets`

- `chat-header` - выбор модели, переключение sidebar, отображение контекста чата.
- `chat-sidebar` - список чатов, rename/delete/clear через `ManageChatService`.
- `chat-input` - ввод, отправка, отмена активного запроса через `SendMessageService`.

## 6.4 `pages`

- `new-chat.page` - старт нового диалога, обработка события отправки и переход к `/chats/:id`.
- `user-chat.page` - загрузка сообщений чата, отображение markdown, retry последнего запроса.

## 6.5 `app`

- `AppComponent` - корневой layout, контроль responsive-состояния (через `ResizeObserver` + `AppUiService`), инициализация данных.
- `AppStateService` - координация guard-ready состояния.
- `AppUiService` - состояние mobile/sidebar.

## 7. Данные и хранилище

Dexie БД (`shared/db/chat.db.ts`, имя `ai-chat-db`):

- `projects` (`id`, `lastUpdate`) - подготовленный слой под проекты.
- `chats` (`id`, `projectId`, `lastUpdate`).
- `messages` (`id`, `sequelId`, `chatId`, `timestamp`, `[chatId+sequelId]`).
- `settings` (`key`).

Миграция (`MigrationService`):

- Перенос legacy-данных из `localStorage` (`ai-chat-chats`, `ai-chat-current-model`) в Dexie.
- Выполняется один раз при старте, до навигации.

## 8. Сеть и протоколы

`SocketService` (`shared/api/socket.service.ts`) - основной runtime-канал:

- Подключение к `environment.apiUrl`, path: `/api/socket.io`.
- События:
- исходящий `chat:request` (payload: `requestId`, `model`, `messages`)
- входящий `chat:chunk` (stream delta)
- входящий `chat:done`
- входящий `chat:error`
- исходящий `chat:abort`
- Поддержка конкурентных активных запросов (`Map<requestId, Observer>`).

`HttpService` (`shared/api/http.service.ts`) - резервный gateway:

- метод `sendChatCompletion(...)`
- в текущем основном чатовом потоке не используется.

## 9. Конфигурация

- `shared/config/models.config.ts`:
- список доступных моделей (`AVAILABLE_MODELS`)
- лимит контекста (`HISTORY_LIMIT`)
- системный промпт (`SYSTEM_PROMPT`)
- интервал персиста стрима (`STREAM_PERSIST_INTERVAL`)

- `shared/config/app.constants.ts`:
- `RepositoryEventType`
- `DEFAULT_CHAT_LIST_LIMIT`

- `environments`:
- local/dev `apiUrl: http://localhost:5000`
- prod `apiUrl: https://chat.my-local-stuff.ru`

## 10. Публичные API и импорт

- Для слоев настроены alias-пути в `tsconfig.json`: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`.
- Каждый слой и слайс экспортирует публичный контракт через `index.ts`.
- Предпочтительный способ импорта - через alias и публичный `index.ts` слайса.

## 11. Ключевые сценарии

Отправка сообщения:

1. Пользователь вводит текст в `ChatInputComponent`.
2. `SendMessageService.sendMessage(...)` валидирует вход и модель.
3. При новом диалоге создается чат (`ChatRepository` + `ChatStore`).
4. Создаются user/assistant сообщения (`MessageRepository`).
5. Стартует socket stream.
6. Дельты потока пишутся в `MessageStore`, затем пачками в Dexie.
7. По завершению/ошибке обновляется чат и финальный статус assistant-сообщения.

Выбор модели:

1. Выбор в `ChatHeaderComponent`.
2. `SelectModelService.selectModel(...)` обновляет `SettingsStore`.
3. Если активного чата нет, модель персистится как глобальная настройка.

Управление историей:

1. Действия из `ChatSidebarComponent`.
2. `ManageChatService` выполняет операции в `ChatRepository`.
3. `ChatStore` синхронизируется локально.
