ALTER TABLE `guilds` ADD `panel_channel_id` text;--> statement-breakpoint
ALTER TABLE `guilds` ADD `panel_message_id` text;--> statement-breakpoint
ALTER TABLE `guilds` ADD `accent_color` integer DEFAULT 2829617 NOT NULL;--> statement-breakpoint
ALTER TABLE `guilds` ADD `banner_url` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `hidden` integer DEFAULT false NOT NULL;