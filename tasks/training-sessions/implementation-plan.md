# Implementation Plan: Training Sessions Workspace

- **Task ID:** `training-sessions`
- **Источники:** [requirements.md](./requirements.md) (подтверждены, D-1…D-4), [TASK.md](./TASK.md)
- **Application Root:** корень репозитория (единственный frontend-кандидат: `package.json`, `vite.config.ts`, `src/`)
- **Статус:** Ready for implementation (`coder`)

## 1. Текущее и целевое поведение

**Сейчас.** `src/App.tsx` — шаблон Vite (лого, счётчик, ссылки); `src/test/smoke.test.tsx` проверяет наличие `<h1>`. HTTP-клиента и мок-механизма нет, MSW не установлен.

**Цель.** `App` — рабочее пространство тренера: загружает сессии через заменяемый HTTP-клиент, отображает loading / error+retry / список, фильтр `All` | `Scheduled`, inline-форма создания (название + дата/время) с валидацией и защитой от повторной отправки; созданная сессия добавляется в список. Мок — fetch-совместимая функция за границей клиента; UI его не импортирует.

## 2. Решения по открытым вопросам (минимальный вариант)

| OQ                        | Решение                                                                                                                                                                                                                                            | Обоснование                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OQ-7** механизм моков   | **Без новой зависимости:** HTTP-клиент на `fetch` принимает `fetch`-совместимую функцию; мок — in-memory реализация этой функции (`createMockFetch`), возвращающая настоящие `Response`. Подключается в `main.tsx` и в тестах. MSW не добавляется. | TASK.md допускает «HTTP client or equivalent replaceable request boundary». Не требуется установка пакета, service worker в `public/` и изменение конфигурации. Граница реальная: клиент формирует URL/метод/JSON-тело и парсит `Response`; замена на настоящий backend = передать глобальный `fetch`. UI не знает о моке (AC-5.1). |
| **OQ-4** пустое состояние | **Отдельное пустое состояние не делается.** При пустом результате рендерится пустой список.                                                                                                                                                        | ТЗ не требует; по D-4 сид содержит все статусы, поэтому ни `All`, ни `Scheduled` пустыми в сценарии не бывают. Добавление было бы расширением требований.                                                                                                                                                                           |
| **OQ-5** сортировка       | **Без сортировки:** порядок как пришёл от API; созданная сессия **добавляется в конец** списка в клиентском состоянии (мок тоже дописывает в конец store).                                                                                         | Минимум логики; требования не задают порядок. Тесты ищут сессию по названию, а не по позиции.                                                                                                                                                                                                                                       |
| **OQ-9** smoke-тест       | **Сохранить `<h1>`** (`Training sessions`) в новом UI; smoke-тест **осознанно обновить** минимально — передать `App` клиент на мок-fetch (иначе рендер вызовет реальный `fetch`). Проверка `<h1>` остаётся.                                        | Тест продолжает проверять то же, изменение — одна строка подключения клиента (AC-6.3).                                                                                                                                                                                                                                              |

Остальные OQ — принимаются допущения по умолчанию из requirements без расширения: OQ-6 — in-memory (новые сессии теряются при перезагрузке); OQ-8/A-2 — ввод `input type="datetime-local"`, отображение через `Intl.DateTimeFormat`/`toLocaleString` в локальной зоне браузера; OQ-10 — только клиентская валидация, мок не валидирует.

## 3. Контракты между шагами

**Модель (A-1):**

```ts
type SessionStatus = "scheduled" | "completed" | "cancelled";
type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  startsAt: string; /* ISO 8601 */
};
type NewSessionInput = { title: string; startsAt: string /* ISO 8601 */ }; // без status (D-2)
```

Только union-типы, без `enum` (`erasableSyntaxOnly`), `import type` (`verbatimModuleSyntax`).

**HTTP-контракт мока (минимальный, OQ-10: без 4xx):**

| Метод/путь           | Тело запроса      | Успех                                                                               | Ошибка                       |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| `GET /api/sessions`  | —                 | `200`, `Session[]`                                                                  | `500` в режиме сбоя (AC-5.4) |
| `POST /api/sessions` | `NewSessionInput` | `201`, `Session` со `status: 'scheduled'` и новым `id`, независимо от тела (AC-5.6) | —                            |

**Клиент:** `SessionsClient = { listSessions(): Promise<Session[]>; createSession(input: NewSessionInput): Promise<Session> }`. Фабрика `createHttpSessionsClient(fetchFn: typeof fetch)`. Не-2xx → `throw Error` (UI показывает фиксированный текст, без деталей — AC-1.4).

**Мок:** `createMockFetch(options?: { delayMs?: number; failListRequests?: number })` → функция с сигнатурой `fetch`; собственный in-memory store на экземпляр (изоляция тестов); `failListRequests` — сколько первых `GET` вернуть `500`. Для проверки AC-3.6 мок предоставляет счётчик/лог полученных `POST` (например, свойство на возвращаемом объекте или колбэк `onRequest`) — форма выбора за `coder`.

**Внедрение клиента:** `App` получает `client: SessionsClient` через prop; создаётся только в `main.tsx` и в тестах.

## 4. Шаги реализации

Порядок по зависимостям. Шаги 2 и 3 независимы друг от друга (оба зависят только от шага 1).

### Шаг 1. Модель и HTTP-клиент

- **Создать** `src/sessions/types.ts` — `SessionStatus`, `Session`, `NewSessionInput`.
- **Создать** `src/api/sessionsClient.ts` — интерфейс `SessionsClient`, `createHttpSessionsClient(fetchFn)`: `GET`/`POST /api/sessions`, JSON, проверка `response.ok`, клиент не отправляет `status`.
- **AC:** AC-1.1, AC-3.7 (отправляется то, что передал UI — trimmed), AC-4.3, AC-5.1.

### Шаг 2. Мок за HTTP-границей

- **Создать** `src/mocks/sessionsMock.ts` — сид-данные и `createMockFetch(options)`.
  - Сид: ≥1 сессия каждого статуса; `scheduled` — с датой в будущем относительно текущего момента, `completed`/`cancelled` — в прошлом.
  - `GET` возвращает копию store; режим сбоя `failListRequests` → `500`.
  - `POST` парсит тело, создаёт `{ id, title, startsAt, status: 'scheduled' }`, дописывает в store, `201`.
  - Опциональная задержка `delayMs` (в dev — небольшая, чтобы loading был виден; в тестах — 0).
  - Неизвестный маршрут → `404`.
- **AC:** AC-5.1, AC-5.3, AC-5.4, AC-5.5, AC-5.6, OQ-6 (in-memory).

### Шаг 3. Валидация формы (чистая функция)

- **Создать** `src/sessions/validateNewSession.ts` — `validateNewSession({ title, startsAtLocal }, now: Date)` → `{ title?: string; startsAt?: string }` + нормализованное значение (trimmed title, ISO `startsAt`).
  - title: `trim()`, длина 3…80 включительно; сообщение «Title must be 3–80 characters» (A-3: UI на английском).
  - startsAt: обязательно, валидная дата, строго `> now`; сообщение «Choose a date and time in the future».
  - `now` передаётся параметром — проверка «в будущем» на момент отправки (AC-3.4), детерминированно в тестах.
- **AC:** AC-3.3, AC-3.4, AC-3.5, AC-3.7.

### Шаг 4. UI рабочего пространства

- **Изменить (заменить шаблон)** `src/App.tsx` — компонент `App({ client })`:
  - `<h1>Training sessions</h1>` (OQ-9).
  - Состояние загрузки: `loading | error | ready`; `useEffect` вызывает `client.listSessions()`, игнорирует устаревший результат после cleanup (StrictMode в dev делает два запроса — это допустимо).
  - `loading` → текст с `role="status"` (например «Loading sessions…») — AC-1.2.
  - `error` → одно сообщение «Couldn't load sessions.» (`role="alert"`) + кнопка «Retry», повторяющая загрузку без перезагрузки страницы — AC-1.4, AC-1.5.
  - `ready` → список (`<ul>`), в элементе: название, статус, отформатированные дата/время — AC-1.3, AC-4.2.
  - Фильтр: две кнопки `All` / `Scheduled` с `aria-pressed` (программно и визуально различимо), по умолчанию `All`; видимый список — производное от `sessions` + `filter`, не хранится отдельно — AC-2.1…AC-2.5, AC-4.4.
  - Кнопка «New session» показывает inline-форму — AC-3.1.
  - `onCreated(session)` дописывает сессию в конец `sessions` (OQ-5); фильтр не сбрасывается (D-3) — AC-4.1, AC-4.4.
- **Создать** `src/sessions/CreateSessionForm.tsx` — props `{ client, onCreated, onCancel? }`:
  - Поля с `<label>`: «Title» (text), «Start date and time» (`datetime-local`). Поля статуса нет — AC-3.2.
  - Submit: `validateNewSession(values, new Date())`; при ошибках — сообщения у полей (связать через `aria-describedby`/`role="alert"`), запрос не отправляется — AC-3.5.
  - Во время запроса: кнопка `disabled` + guard через `useRef`, чтобы повторный submit игнорировался — AC-3.6.
  - Успех: `onCreated(created)`, форма сбрасывается/закрывается. Ошибка создания: простое сообщение в форме, кнопка снова активна (A-4).
- **Изменить** `src/App.css` — заменить шаблонные стили минимальными для списка/фильтра/формы (включая видимый стиль для `aria-pressed="true"`). `src/index.css` и `src/assets/*` не трогать (неиспользуемые ассеты не ломают build/lint; удаление — несвязанная правка).
- **AC:** AC-1.2…AC-1.5, AC-2._, AC-3._, AC-4.\*.

### Шаг 5. Композиция и обновление smoke-теста

- **Изменить** `src/main.tsx` — `const client = createHttpSessionsClient(createMockFetch({ delayMs: <небольшая>, failListRequests }))`, `<App client={client} />`. Единственное место, где UI-дерево соединяется с моком.
  - **Воспроизведение ошибки загрузки в dev:** параметр URL `?fail=1` (читается через `URLSearchParams(window.location.search)`) включает `failListRequests`; без параметра — `0`, приложение работает штатно.
  - Учесть StrictMode: в dev эффект монтируется дважды и уходит два `GET`; первый (отброшенный) запрос «съел» бы единственный сбой, и ошибка не появилась бы на экране. Поэтому при `?fail=1` выставлять `failListRequests` так, чтобы оба стартовых `GET` вернули `500` (в dev — `2`), а запрос по «Retry» — успешный. Итог: при `?fail=1` виден экран ошибки, «Retry» → список.
  - Режим сбоя задаётся только в `main.tsx` (композиция); UI-компоненты о нём не знают (AC-5.1).
- **Изменить** `src/test/smoke.test.tsx` — передать `client` на `createMockFetch()`; проверка `<h1>` остаётся (OQ-9). При предупреждениях `act(...)` из-за асинхронной загрузки — дождаться списка (`findBy…`).
- **AC:** AC-5.1, AC-5.4, AC-6.3, AC-1.4, AC-1.5 (ручное воспроизведение).

### Шаг 6. Поведенческие тесты

- **Создать** `src/test/sessions-workspace.test.tsx` (см. §5): обязательные тесты фильтрации, создания и **«ошибка → Retry → список»**.
- **Создать (опционально, рекомендуется)** `src/sessions/validateNewSession.test.ts` — граничные значения валидации.
- **AC:** AC-6.1, AC-6.2, AC-1.4, AC-1.5, AC-5.4.

### Шаг 7. Проверка и ручной прогон

- Команды из §6; ручной прогон в браузере и запись наблюдений в [workflow-log.md](./workflow-log.md) → «Manual Browser Observation».
- **AC:** AC-6.3, AC-7.1, AC-7.2.

## 5. Тесты

### Основной сценарий (essential) — `src/test/sessions-workspace.test.tsx`

Рендер `<App client={createHttpSessionsClient(createMockFetch())} />` — тот же клиент и мок, что в приложении; взаимодействие только через роли/тексты (`user-event`).

1. **«filters sessions by Scheduled status»** — дождаться списка; при `All` видны сессии всех трёх статусов; клик `Scheduled` → видны только `scheduled`, `completed`/`cancelled` скрыты, кнопка `Scheduled` имеет `aria-pressed="true"`; клик `All` → снова все. Покрывает AC-1.1, AC-1.3, AC-2.1…AC-2.5.
2. **«creates a session and shows it in the list»** — выбрать `Scheduled`, открыть форму, ввести название с пробелами по краям и дату в будущем, отправить → сессия с trimmed-названием и статусом `scheduled` видна при `Scheduled` и после переключения на `All`; мок получил ровно один `POST`, без `status` в теле. Покрывает AC-3.1, AC-3.6, AC-3.7, AC-4.1…AC-4.4, AC-5.6.
3. **«shows an error and recovers after Retry»** (обязательный) — рендер с `createMockFetch({ failListRequests: 1 })` (в тестах StrictMode нет — один стартовый `GET`): виден `role="alert"` с понятным сообщением без технических деталей (нет кода статуса, текста исключения, stack trace), списка нет → клик «Retry» → сообщение об ошибке исчезает, отображается список сессий. Покрывает AC-1.4, AC-1.5, AC-5.4.

**Тест, покрывающий основной сценарий:** `src/test/sessions-workspace.test.tsx` → «creates a session and shows it in the list» (вместе с «filters sessions by Scheduled status» закрывает весь пользовательский поток list → filter → create). Для AC-6.1 достаточно любого из двух; планируются оба. Тест «shows an error and recovers after Retry» обязателен дополнительно — он автоматически защищает восстановимость ошибки (AC-1.5).

Замечание: `user.type` в `datetime-local` в jsdom может работать ненадёжно из-за санитизации значения. Используйте фиксированное далёкое будущее (`2099-01-01T10:00`); если посимвольный ввод не принимается — `fireEvent.change` на поле, найденном по label (остаётся взаимодействием через UI).

### Дополнительные, по риску (не обязательны для AC-6)

- **Валидация в UI** — короткое название / прошедшая дата → сообщение, `POST` не отправлен (AC-3.5).
- **`validateNewSession.test.ts`** — длины 2/3/80/81 после trim, пустая дата, `now` и `now+1ms` (AC-3.3, AC-3.4).
- **Двойной клик по submit** при `delayMs > 0` → один `POST` (AC-3.6, усиленная проверка).
- **Loading** — `role="status"` виден до ответа (AC-1.2).

## 6. Команды проверки

Скрипты из `package.json` (установка зависимостей не требуется):

| Команда                                            | Что проверяет                                                 |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `npm test`                                         | все тесты Vitest, включая smoke и `sessions-workspace`        |
| `npm test -- src/test/sessions-workspace.test.tsx` | только основной сценарий                                      |
| `npm run lint`                                     | oxlint (`rules-of-hooks`, `only-export-components`)           |
| `npm run build`                                    | `tsc -b` + `vite build`                                       |
| `npm run dev`                                      | ручной прогон; URL брать из вывода Vite, порт не предполагать |

Ручная проверка (AC-7): открыть URL → виден loading, затем список с тремя статусами → `Scheduled` / `All` → «New session»: невалидный ввод показывает сообщения → валидный ввод → сессия в списке; проверить консоль браузера.

Ручная проверка ошибки (обязательна, AC-1.4, AC-1.5, AC-5.4): открыть тот же URL с `?fail=1` → после loading виден экран ошибки с одним понятным сообщением без технических деталей и кнопкой «Retry» → нажать «Retry» → ошибка исчезает, отображается список, страница не перезагружалась. Зафиксировать наблюдаемое в [workflow-log.md](./workflow-log.md) → «Manual Browser Observation».

## 7. Сводка файлов

| Файл                                      | Действие                      | Шаг |
| ----------------------------------------- | ----------------------------- | --- |
| `src/sessions/types.ts`                   | создать                       | 1   |
| `src/api/sessionsClient.ts`               | создать                       | 1   |
| `src/mocks/sessionsMock.ts`               | создать                       | 2   |
| `src/sessions/validateNewSession.ts`      | создать                       | 3   |
| `src/sessions/CreateSessionForm.tsx`      | создать                       | 4   |
| `src/App.tsx`                             | заменить шаблон               | 4   |
| `src/App.css`                             | заменить шаблонные стили      | 4   |
| `src/main.tsx`                            | изменить (композиция клиента) | 5   |
| `src/test/smoke.test.tsx`                 | изменить (передать клиент)    | 5   |
| `src/test/sessions-workspace.test.tsx`    | создать                       | 6   |
| `src/sessions/validateNewSession.test.ts` | создать (опционально)         | 6   |

Не меняются: `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `src/index.css`, `src/assets/*`, `public/*`.

## 8. Риски и откат

- Откат — revert изменённых файлов `src/`; конфигурация и зависимости не меняются, feature flag не нужен.
- Мок попадает в production-бандл — допустимо: реального backend нет (AC-5.3), деплой — non-goal.
- StrictMode в dev делает двойной `GET` — безвредно при игнорировании устаревшего результата в `useEffect`.

## 9. Рекомендуемый следующий шаг

`coder` — реализация шагов 1–6 по этому плану, затем `verify` и ручной прогон (шаг 7).
