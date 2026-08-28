PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`creator_channel_id` text,
	`category_id` text,
	`panel_channel_id` text,
	`panel_message_id` text,
	`default_user_limit` integer DEFAULT 0 NOT NULL,
	`delete_delay_seconds` integer DEFAULT 5 NOT NULL,
	`creation_cooldown_seconds` integer DEFAULT 0 NOT NULL,
	`accent_color` integer DEFAULT 2829617 NOT NULL,
	`banner_url` text,
	`icon_pack` text DEFAULT 'niako' NOT NULL,
	`icon_colors` text DEFAULT '{}' NOT NULL,
	`template` text DEFAULT 'default' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_guilds`("id", "guild_id", "creator_channel_id", "category_id", "panel_channel_id", "panel_message_id", "default_user_limit", "delete_delay_seconds", "creation_cooldown_seconds", "accent_color", "banner_url", "icon_pack", "icon_colors", "template", "enabled", "created_at", "updated_at") SELECT "id", "guild_id", "creator_channel_id", "category_id", "panel_channel_id", "panel_message_id", "default_user_limit", "delete_delay_seconds", "creation_cooldown_seconds", "accent_color", "banner_url", "icon_pack", "icon_colors", "template", "enabled", "created_at", "updated_at" FROM `guilds`;--> statement-breakpoint
DROP TABLE `guilds`;--> statement-breakpoint
ALTER TABLE `__new_guilds` RENAME TO `guilds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `guilds_guild_id_unique` ON `guilds` (`guild_id`);