ALTER TABLE `workshop_settings` ADD `menu_name` text DEFAULT 'Workshop' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `menu_subtitle` text DEFAULT 'Service desk' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `logo_data_url` text DEFAULT '' NOT NULL;
