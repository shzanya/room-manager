# Roles Setup

Краткая настройка ролей для Room Manager.

## 1. Роли сервера

Рекомендуется:

```text
@Admin
@Moderator
@Verified
@Boy
@Girl
@Unverified
@Quarantine
@Muted
```

### @Admin

Для администраторов.

**Права:**

* Manage Guild
* Manage Channels
* Manage Roles

### @Moderator

Для модераторов.

**Права:**

* View Channels
* Connect
* Speak
* Move Members
* Mute Members
* Deafen Members

### @Verified / @Boy / @Girl

Обычные пользователи.

**Права:**

* View Channels
* Connect
* Speak
* Send Messages

### @Unverified / @Quarantine

Ограниченные пользователи.

В Room Manager → `restricted`.

### @Muted

Роль для замьюченных пользователей.

В Room Manager:

* `restricted`
* `Mute role`

---

## 2. Группы Room Manager

```text
administrators → @Admin

moderators → @Moderator

members → @Verified @Boy @Girl

restricted → @Unverified @Quarantine @Muted
```

---

## 3. Права Room Manager

### Create Room

```text
Allow → members
Deny  → restricted
```

### Manage Room

```text
Allow → members, moderators
Deny  → restricted
```

### Whitelist

```text
Allow → members, moderators
Deny  → restricted
```

### Mute

```text
Allow → members, moderators
Deny  → restricted

Mute role → @Muted
```

### Settings

```text
Allow → administrators
Deny  → restricted
```

---

## 4. Роль бота

Роль **Room Manager должна находиться выше**:

```text
@Muted
@Moderator
@Verified
@Boy
@Girl
@Unverified
@Quarantine
```

Иначе бот не сможет управлять ролями.

Боту нужны:

* Manage Channels
* Manage Roles
* View Channels
* Connect
* Move Members
* Mute Members
* Deafen Members
* Send Messages
* Embed Links
* Read Message History

---

## 5. Важно

`Deny` всегда важнее `Allow`.

Например:

```text
@Boy    → Allow
@Muted  → Deny
```

Пользователь с обеими ролями:

```text
@Boy + @Muted
```

→ **доступ запрещён**.

Владелец комнаты всегда может управлять своей комнатой.

`@Muted`, выданный вручную администратором, Room Manager автоматически не снимает.
