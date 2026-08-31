-- Room Manager: Initial schema
-- Generated from drizzle-orm schema definitions

CREATE TYPE "room_state" AS ENUM ('active', 'cooldown', 'deleting');

CREATE TABLE "guilds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" varchar(20) NOT NULL UNIQUE,
  "creator_channel_id" varchar(20),
  "category_id" varchar(20),
  "panel_channel_id" varchar(20),
  "panel_message_id" varchar(20),
  "log_channel_id" varchar(20),
  "default_user_limit" integer NOT NULL DEFAULT 0,
  "delete_delay_seconds" integer NOT NULL DEFAULT 5,
  "creation_cooldown_seconds" integer NOT NULL DEFAULT 0,
  "accent_color" integer NOT NULL DEFAULT 2826289,
  "banner_url" text,
  "icon_pack" varchar(50) NOT NULL DEFAULT 'niako',
  "icon_colors" text NOT NULL DEFAULT '{}',
  "template" varchar(50) NOT NULL DEFAULT 'default',
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "guild_settings" (
  "guild_id" varchar(20) PRIMARY KEY REFERENCES "guilds"("guild_id") ON DELETE CASCADE,
  "role_policy" jsonb DEFAULT '{}',
  "control_settings" jsonb DEFAULT '{}',
  "panel_text" jsonb DEFAULT '{}',
  "locale" varchar(10) DEFAULT 'ru',
  "emoji_cache" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "guild_cooldowns" (
  "guild_id" varchar(20) PRIMARY KEY REFERENCES "guilds"("guild_id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "rooms" (
  "id" uuid PRIMARY KEY,
  "guild_id" varchar(20) NOT NULL REFERENCES "guilds"("guild_id") ON DELETE CASCADE,
  "channel_id" varchar(20) NOT NULL UNIQUE,
  "owner_id" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "user_limit" integer NOT NULL DEFAULT 0,
  "state" "room_state" NOT NULL DEFAULT 'active',
  "locked" boolean NOT NULL DEFAULT false,
  "hidden" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_activity_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "room_mutes" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "user_id" varchar(20) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "room_whitelists" (
  "room_id" uuid NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "user_id" varchar(20) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "app_emoji_cache" (
  "name" varchar(100) PRIMARY KEY,
  "data" jsonb NOT NULL
);
