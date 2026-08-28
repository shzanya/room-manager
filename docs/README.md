# Room Manager

Discord-бот приватных голосовых комнат («temp voice» / hub-канал) на Bun +
TypeScript. Пользователь заходит в канал-хаб → бот создаёт ему личную голосовую
комнату, выдаёт владельцу права и панель управления, а после того как комната
опустела — удаляет её по таймеру.

Репозиторий — монорепозиторий (Bun workspaces + Turborepo). Рабочий и
единственный полностью реализованный запускаемый пакет — `apps/bot`;
`apps/api` и `apps/dashboard` существуют как заготовки (пустые точки входа).

---

## 1. Стек и инструменты

| Область | Решение |
| --- | --- |
| Рантайм / пакетный менеджер | Bun `1.3.14` (`packageManager` в корневом `package.json`) |
| Язык | TypeScript, ESM, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| Оркестрация задач | Turborepo (`turbo.json`: `build`, `typecheck`, `test`, `dev`) |
| Discord | `discord.js` 14 + `discordx` 11 (декораторы), Components V2 |
| БД | SQLite через `bun:sqlite` + Drizzle ORM, миграции — `drizzle-kit` |
| Валидация | Zod 4 (только для схемы окружения) |
| Линт / формат | Biome (2 пробела, LF, двойные кавычки, обязательные `;`) |
| Графика | `@napi-rs/canvas` (перекраска иконок, баннеры) |

Особенность: `emitDecoratorMetadata` в Bun не работает, поэтому DI-контейнер
(`tsyringe`) для классов-обработчиков не используется. Вместо него — ручной
сервис-локатор `apps/bot/src/services/registry.ts` (`initServices()` / `svc()`),
а все `@Discord()`-классы имеют конструктор без аргументов и достают зависимости
через `svc()`.

---

## 2. Структура репозитория

```
apps/
  bot/          основной Discord-бот (единственный рабочий рантайм)
  api/          заготовка HTTP API (src/index.ts пуст)
  dashboard/    заготовка веб-панели (src/main.tsx пуст)
packages/
  config/       загрузка и валидация .env (Zod)
  contracts/    доменные типы и константы (Room, GuildConfig, иконки)
  core/         доменная логика: сервисы, политики, стейт-машина комнаты
  database/     Drizzle-схема, репозитории, мапперы, клиент SQLite
  logger/       минимальный логгер с уровнями и префиксом
  shared/       branded-типы ID, константы, AppError
data/           SQLite-файл + JSON-хранилища настроек (рантайм-состояние)
drizzle/        сгенерированные SQL-миграции и снапшоты
docs/           документация (этот файл, emojis.md, roles.md)
scripts/        служебные Bun-скрипты (scaffold, inspect-db, setup-*)
tests/e2e/      пусто (только .gitkeep)
```

Пустые файлы-заготовки: `README.md` (корневой), `LICENSE`,
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `bunfig.toml`,
все три workflow в `.github/workflows/` и `pull_request_template.md`.
CI фактически не настроен.

---

## 3. Архитектура

Слои разделены по зависимостям сверху вниз, обратных зависимостей нет:

```
apps/bot  (Discord-адаптер: команды, кнопки, селекты, модалки, панели)
    ↓
packages/core        (RoomService, RoomLifecycleService, GuildService, политики)
    ↓
packages/database    (RoomRepository, GuildRepository, мапперы, Drizzle)
    ↓
SQLite (data/room-manager.db)

packages/contracts   типы, общие для всех слоёв
packages/shared      branded ID (GuildId, ChannelId, UserId, RoomId), AppError
packages/config      env
packages/logger      логирование
```

`packages/shared/src/ids.ts` вводит branded-типы, поэтому «сырые» строки
Discord приводятся явно (`guild.id as GuildId`) — это осознанный барьер,
чтобы не перепутать ID канала с ID комнаты.

### Точка входа бота

`apps/bot/src/index.ts` собирает граф зависимостей вручную, затем:

1. `loadEnv()` — валидация окружения (падает сразу при некорректном `.env`).
2. Создание `Client` (discordx) с интентами `Guilds`, `GuildVoiceStates`,
   `GuildMessages`, `MessageContent`. `MessageContent` — привилегированный
   интент, нужен для загрузки баннера вложением, его надо включить в
   Dev Portal. Глобально задан `allowedMentions: { parse: [] }` — упоминания
   рендерятся, но никого не пингуют.
3. `initServices({...})` — заполнение сервис-локатора.
4. `importx(...)` — автозагрузка `events`, `commands`, `components`.
5. `client.login()`, затем **вручную** навешивается
   `Events.InteractionCreate → client.executeInteraction(...)` (без этого
   discordx не диспатчит интеракции), затем `initApplicationCommands()`.
6. Фоновая синхронизация эмодзи приложения (`appEmojiService.syncDefaults()`).
7. Graceful shutdown по `SIGINT`/`SIGTERM`: сброс таймеров кулдаунов и
   уборки, `client.destroy()`. `unhandledRejection` и `uncaughtException`
   только логируются — одна упавшая интеракция не должна убивать бота.

---

## 4. Модель данных

Две таблицы, SQLite, миграции в `drizzle/` (`0000`…`0003`).
Миграции применяются **автоматически при старте** в
`packages/database/src/client.ts` (`migrate()` внутри `try/catch`, ошибка
логируется, но не роняет процесс).

### `guilds` — настройки сервера (`GuildConfig`)

| Поле | Смысл |
| --- | --- |
| `guildId` | ID сервера Discord (уникальный) |
| `creatorChannelId` | канал-хаб «➕ Создать комнату» |
| `categoryId` | категория, в которой живут комнаты |
| `panelChannelId` / `panelMessageId` | канал и сообщение кнопочной панели |
| `defaultUserLimit` | лимит участников новой комнаты (0 = без лимита) |
| `deleteDelaySeconds` | задержка удаления пустой комнаты |
| `creationCooldownSeconds` | антиспам-кулдаун на создание комнат в гильдии |
| `accentColor` | акцентный цвет контейнеров (по умолчанию `0x2b2d31`) |
| `bannerUrl` | баннер панели (или `null` → дефолтный) |
| `iconPack` | пак иконок (`niako` по умолчанию) |
| `iconColors` | JSON: цвет каждой иконки-действия |
| `template` | шаблон текста панели (`assets/templates/*.json`) |
| `enabled` | глобальный выключатель для сервера |

### `rooms` — комнаты

| Поле | Смысл |
| --- | --- |
| `id` | UUID комнаты (домейн-ID, не Discord) |
| `guildId` | FK → `guilds.id`, `ON DELETE CASCADE` |
| `channelId` | ID голосового канала, уникальный |
| `ownerId` | владелец |
| `name`, `userLimit`, `locked`, `hidden` | состояние комнаты |
| `state` | `active` \| `cooldown` \| `deleting` |
| `createdAt`, `updatedAt`, `lastActivityAt` | таймстемпы (ms) |

### Стейт-машина комнаты

`packages/core/src/rooms/RoomStateMachine.ts` — единственный источник правды
о переходах:

```
active   → cooldown
cooldown → active | deleting
deleting → (никуда, терминальное)
```

Переход в то же состояние разрешён (идемпотентность). Недопустимый переход
бросает `InvalidRoomStateTransitionError`, проверка живёт в
`RoomService.transition()`, то есть обойти её через репозиторий нельзя, только
если писать напрямую.

---

## 5. Жизненный цикл комнаты

Весь сценарий разруливает `apps/bot/src/VoiceStateHandler.ts` по событию
`voiceStateUpdate`.

**Вход в канал-хаб:**

1. Если канал уже управляемая комната — сброс кулдауна, возврат в `active`.
2. Иначе проверяется конфиг гильдии: `enabled` и совпадение с
   `creatorChannelId`.
3. Проверка ролевой политики (`RolePolicyService.canCreateRoom`) — держатель
   запрещающей роли комнату не создаст.
4. Если у пользователя уже есть своя комната (`active` или `cooldown`) — его
   **переносят в неё**, а не создают вторую. Это же снимает запланированное
   удаление.
5. Кулдаун создания на гильдию (`RoomCreationPolicy`, таймеры в памяти).
6. `RoomChannelService.create()` создаёт голосовой канал в категории и
   вызывает `lockPermissions()` — комната наследует приватность категории
   (`@everyone` запрещён), а владельцу точечно выдаются `ViewChannel` +
   `Connect`.
7. Запись комнаты в БД, перенос пользователя. Если перенос упал — канал и
   запись откатываются (компенсирующее удаление).
8. Если режим управления не `chat` — в голосовой канал публикуется
   Components V2-панель с одним select-меню; владельца пингуют **один раз**,
   только на этом свежем сообщении.

**Выход:** если управляемая комната опустела → `startCooldown()` +
`RoomCleanupService.schedule()`.

**`RoomCleanupService`** (`apps/bot/src/RoomCleanupService.ts`):

- держит `Map<RoomId, Timeout>`; `cancel()` при возврате людей;
- задержка = `deleteDelaySeconds`, либо `0` при включённом
  «мгновенном удалении» (`control-settings.json`);
- перед удалением перепроверяет всё заново: комната та же, канал тот же,
  гильдия та же, состояние всё ещё `cooldown`, канал пуст. Если в канал
  успели зайти — комната возвращается в `active`;
- если канал уже удалён вручную или перестал быть голосовым — запись просто
  вычищается из БД;
- если `channel.delete()` упал — состояние откатывается в `cooldown`, чтобы
  комната не осталась «зависшей» в `deleting`;
- `restore()` вызывается на `ClientReady` и восстанавливает таймеры после
  перезапуска, вычищая мусорные записи.

---

## 6. Интерфейс бота

### Slash-команды

Обе — в группе `/setup`, `defaultMemberPermissions: ManageGuild`.

| Команда | Опции | Что делает |
| --- | --- | --- |
| `/setup basic` | `category`, `hub`, `panel` (все необязательные) | Создаёт/находит категорию «Приватные комнаты», хаб «➕ Создать комнату», канал «💬-управление-комнатами», публикует панель. Право `ManageGuild` перепроверяется в коде. |
| `/setup settings` | — | Интерактивное меню настроек (иконки, дизайн, управление, роли, язык). |

Существующие каналы переиспользуются только если реально живы на сервере
(`fetchExistingChannel`), иначе создаются заново — поэтому повторный
`/setup basic` не плодит дубликаты.

### Две поверхности управления комнатой

Режим задаётся в `/setup settings → Управление` и хранится в
`data/control-settings.json`:

- `voice` — только select-меню внутри голосового канала; текстовый
  канал-панель **удаляется**;
- `chat` — только кнопочная панель в текстовом канале; in-voice меню
  вычищаются;
- `both` — обе поверхности (по умолчанию).

Переключение применяется немедленно ко всем живым комнатам
(`VoiceStateHandler.applyControlMode`).

### Кнопки панели (`room:*`)

`limit`, `lock`, `unlock`, `access:remove`, `access:add` (ряд 0);
`rename`, `owner`, `kick`, `mute`, `unmute` (ряд 1); плюс `info`, `hide`,
`reset`.

### In-voice select `room:vc:manage`

| Значение | Действие |
| --- | --- |
| `rename` | модалка `room:rename:modal` |
| `limit` | модалка `room:limit:modal` |
| `lock` / `unlock` | `Connect` для `@everyone` |
| `wl` | вайтлист (подтягивается из существующих overwrite-ов канала) |
| `owner` | передача владельца (user-select) |
| `kick` | выгнать участника (user-select) |
| `mutes` | управление мутами |
| `soundpad` | переключение `UseSoundboard` + `UseExternalSounds` |
| `activities` | переключение `UseEmbeddedActivities` |

Подписи `soundpad`/`activities` переписываются в момент отправки и
показывают **действие**, а не состояние.

### Компоненты настроек

`setup:set:section`, `setup:set:home`, `setup:lang`, `setup:tpl`,
`setup:ctrl:mode`, `setup:ctrl:instant`, `setup:ctrl:public`,
`setup:icons:pack|preset|global`, `setup:banner:url|reset`,
`setup:design:text|text:reset|upload`, и семейство `setup:roles:*`
(часть — по регулярным выражениям, например
`/^setup:roles:allow-groups:.+$/`).

### Components V2

`apps/bot/src/discord/V2.ts` — единый формат любого ответа бота:

```
# <Заголовок>
<@актор>, <что произошло>
> <что именно изменилось>
```

с аватаркой актора как thumbnail. Флаги: `V2_FLAG = 32768`,
`EPHEMERAL_FLAG = 64`. `v2Error()` — тот же контейнер с красным акцентом
(`0xed4245`). `allowedMentions: { parse: [] }` зашит в payload.

### Обработка ошибок

Глобальный `interactionCreate`-обработчик **намеренно отключён**
(`events/interactionError.event.ts`): он гонялся с диспатчем discordx.
Каждый обработчик сам делает `try/catch` + `deferReply`/`editReply`.

Гард `guards/IsRoomOwner.ts` проверяет: интеракция в гильдии, автор в
голосовом канале, канал — управляемая комната, автор — её владелец.

---

## 7. Сервисы бота

| Сервис | Назначение | Хранилище |
| --- | --- | --- |
| `SetupService` | создание каналов, публикация и обновление панели, синхронизация прав категории с ролевой политикой | БД `guilds` |
| `IconSettingsService` | всё меню `/setup settings` (~1600 строк): иконки, дизайн, управление, роли, язык | БД + JSON |
| `AppEmojiService` | загрузка иконок как эмодзи **приложения** (`RM_<ACTION>_<COLOR>`), контент-адресация по MD5, ленивая генерация | `data/emoji-cache.json` |
| `EmojiUploader` | перекраска PNG/WebP через canvas, валидация вложений, генерация цветовых вариантов | файлы паков |
| `BannerService` | дефолтный/кастомный баннер панели, валидация URL и вложений | БД + `assets/panel/banners/` |
| `RolePolicyService` | allow/deny-политика по группам ролей и конкретным ролям | `data/role-policy.json` |
| `ControlSettingsService` | режим управления, мгновенное удаление, публичная категория | `data/control-settings.json` |
| `PanelTextService` | переопределение заголовка/описания панели | `data/panel-text.json` |
| `LocaleService` | язык сервера | `data/locales.json` |
| `TemplateService` | шаблоны текста панели | `assets/templates/*.json` |
| `MutesRegistry`, `WhitelistRegistry` | муты и вайтлист комнат | только память |

Важно: муты и вайтлист живут **в памяти** и теряются при перезапуске.
Вайтлист частично восстанавливается из permission overwrites канала при
открытии соответствующего меню.

### Ролевая политика

Действия: `createRoom`, `manageRoom`, `whitelist`, `mute`, `settings`.
Группы: `administrators`, `moderators`, `members`, `restricted`.
Порядок разрешения (deny всегда сильнее allow):

1. `adminRoles` — обход всех проверок;
2. явный deny-роль;
3. явный allow-роль;
4. deny-группа;
5. allow-группа;
6. по умолчанию — запрет.

Запрещённые в `createRoom` роли дополнительно получают
`ViewChannel` + `Connect` deny на самой категории
(`SetupService.syncCategoryPermissions`), устаревшие overwrite-ы снимаются.
Отдельно настраивается `muteRoleId` — роль, которая выдаётся/снимается при
муте в комнате и автоматически снимается при выходе из комнаты.
Подробнее — `docs/roles/roles.md`.

### Иконки и эмодзи

Пак — это просто папка в `apps/bot/assets/emojis/packs/<имя>/`, она
подхватывается автоматически без изменений кода. Файлы: `limit`, `lock`,
`rename`, `owner`, `kick`, `mute`, `access`, `sounpad`, `activati`
(один файл покрывает пару действий: `lock`→`lock`/`unlock`,
`mute`→`mute`/`unmute`, `access`→`addAccess`/`removeAccess`).
12 цветов + произвольный hex, пресеты `default`, `rainbow`, `traffic`,
`discord`, `monochrome`. Подробнее — `docs/emojis/emojis.md`.

### Локализация

`apps/bot/src/i18n/`: русский (`ru.ts`, ~21 КБ, эталонный словарь и источник
типа `Dictionary`) и английский (`en.ts`). Язык выбирается на гильдию,
fallback — русский. Подстановка через `format(template, params)` с
`{placeholders}`.

---

## 8. Запуск

```bash
bun install
cp .env.example .env      # заполнить DISCORD_TOKEN и DISCORD_CLIENT_ID
bun run start             # = bun run --cwd apps/bot start
```

Переменные окружения (`packages/config/src/schema.ts`, все проверяются Zod):

| Переменная | Обязательна | По умолчанию |
| --- | --- | --- |
| `DISCORD_TOKEN` | да | — |
| `DISCORD_CLIENT_ID` | да | — |
| `NODE_ENV` | нет | `development` |
| `DATABASE_URL` | нет | `./data/room-manager.db` |
| `LOG_LEVEL` | нет | `info` |

Права бота в Discord: `Manage Channels`, `Manage Roles`, `View Channels`,
`Connect`, `Move Members`, `Mute Members`, `Deafen Members`,
`Send Messages`, `Embed Links`, `Read Message History`. Роль бота должна
быть **выше** всех управляемых ролей. Привилегированный интент
`Message Content` — включить в Dev Portal.

### Скрипты

| Команда | Что делает |
| --- | --- |
| `bun run start` | запуск бота (`--env-file=../../.env`) |
| `bun run dev` | `turbo dev` |
| `bun run build` / `typecheck` / `test` | соответствующие turbo-задачи |
| `bun run lint` / `check` | `biome check .` |
| `bun run format` | `biome format --write .` |
| `bun run db:generate` / `db:migrate` / `db:push` | drizzle-kit |
| `bun scripts/inspect-db.ts` | таблицы, колонки, число применённых миграций |
| `bun run setup:workspaces` / `setup:dependencies` | служебный скаффолдинг |

`drizzle.config.ts`: схема — `packages/database/src/schema/index.ts`,
вывод — `./drizzle`, диалект `sqlite`, `strict: true`.

---

## 9. Текущее состояние и известные ограничения

Реализовано и работает:

- полный жизненный цикл комнат с восстановлением после перезапуска;
- две поверхности управления (in-voice select и кнопочная панель);
- меню настроек с иконками, баннерами, шаблонами, ролями и языком;
- пайплайн эмодзи приложения с контент-адресным кэшем;
- ролевая политика с приоритетом deny и синхронизацией прав категории.

Не готово / стоит учитывать:

- `apps/api` и `apps/dashboard` — пустые заготовки, точки входа нулевого
  размера;
- тестов нет: `tests/e2e/` содержит только `.gitkeep`, `turbo test` не
  запускает ничего реального;
- CI не настроен — все три workflow в `.github/workflows/` пустые;
- корневой `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md` пустые;
- `MutesRegistry` и `WhitelistRegistry` не персистентны;
- `IconSettingsService` (~1600 строк) и `voiceControl.select.ts` (~856 строк)
  заметно переросли и просят разбиения;
- в `apps/bot/src/` есть `discord.ts` с `createDiscordClient()`, который не
  используется: `index.ts` создаёт `Client` сам, с другим набором интентов;
- сервисы вычисляют путь к `data/` как `process.cwd() + "../../data"`, то
  есть неявно требуют запуска из `apps/bot`;
- `.env` присутствует в рабочей копии — секреты не должны попадать в
  репозиторий;
- в `apps/bot/assets/panel/banners/` лежат крупные PNG (до ~1.6 МБ),
  загруженные в рантайме.

---

## 10. Соглашения

- Biome: 2 пробела, LF, двойные кавычки, trailing commas, `;` обязательны.
- Ответы бота — только через `v2Action`/`v2ActionFor`/`v2Error`, никаких
  «сырых» embed-ов.
- Discord-ID приводятся к branded-типам на границе адаптера.
- Обработчики discordx — конструктор без аргументов + `svc()`.
- Комментарии в коде объясняют «почему», а не «что» — при правках эти
  пояснения (особенно про Bun/decorator metadata и ручной
  `InteractionCreate`) лучше сохранять.
