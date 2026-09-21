CREATE TABLE `report_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`user_id` integer NOT NULL,
	`report_id` text NOT NULL,
	`name` text NOT NULL,
	`filters_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_presets_owner_name` ON `report_presets` (`company_code`,`user_id`,`report_id`,`name`);