# AI Chat Frontend

Фронтенд-приложение для чата с AI: создание диалогов, выбор модели, потоковый ответ ассистента и локальное хранение истории.

## Что умеет приложение

- Создавать новые диалоги и продолжать существующие.
- Отправлять сообщения и получать потоковый ответ от сервера.
- Выбирать модель AI для текущего чата и глобально.
- Переименовывать/удалять чаты и очищать историю.
- Хранить историю и настройки локально в IndexedDB.
- Поддерживает PWA в production (manifest + Service Worker).

## Технологический стек

- `Angular 21` (standalone components)
- `TypeScript` (`strict`)
- `Taiga UI` для интерфейса
- `@ngrx/signals` + Angular Signals для состояния
- `Dexie` + IndexedDB для локального хранения
- `socket.io-client` как основной транспорт + HTTP fallback
- `PWA` (manifest + Service Worker в production)
- `Less` для стилей
- `ESLint` + `Prettier` + `Husky` для качества кода

## Архитектура

Проект организован по FSD-слоям:

- `app` - bootstrap, роутинг, guard, app-level сервисы
- `pages` - маршрутизируемые страницы
- `widgets` - составные UI-блоки
- `features` - пользовательские сценарии (orchestration)
- `entities` - доменные модели, store и repository
- `shared` - инфраструктура, утилиты, конфиги, общие UI-элементы

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск в локальном окружении

```bash
npm start
```

После запуска приложение доступно по адресу: `http://localhost:4200`.

По умолчанию локальное окружение ожидает backend на `http://localhost:5000`.

## Основные команды

```bash
# локальная разработка
npm start

# сборка (local)
npm run build

# production-сборка
npm run build:prod

# линтинг
npm run lint

# форматирование
npm run format
npm run format:check

# тесты
npm run test
```

## Конфигурация окружений

- `src/environments/environment.local.ts` - локальная разработка
- `src/environments/environment.prod.ts` - production
- `src/environments/environment.ts` - базовая конфигурация

## Структура проекта

```text
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
  environments/
```
