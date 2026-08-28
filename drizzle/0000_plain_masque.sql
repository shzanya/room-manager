CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`creator_channel_id` text,
	`category_id` text,
	`default_user_limit` integer DEFAULT 0 NOT NULL,
	`delete_delay_seconds` integer DEFAULT 5 NOT NULL,
	`creation_cooldown_seconds` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guilds_guild_id_unique` ON `guilds` (`guild_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`user_limit` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_channel_id_unique` ON `rooms` (`channel_id`);