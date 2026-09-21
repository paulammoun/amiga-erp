ALTER TABLE `workshop_settings` ADD `overview_kicker` text DEFAULT 'BUSINESS DESK' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `overview_title` text DEFAULT 'Ready for your next sale.' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `overview_description` text DEFAULT 'Create invoices, track items and serve customers from one place.' NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
