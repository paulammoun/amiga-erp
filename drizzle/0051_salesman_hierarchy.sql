CREATE TABLE `area_managers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `area_managers_company_code_unique` ON `area_managers` (`company_code`,`code`);--> statement-breakpoint
CREATE TABLE `sales_supervisors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`area_manager_id` integer NOT NULL,
	FOREIGN KEY (`area_manager_id`) REFERENCES `area_managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_supervisors_company_code_unique` ON `sales_supervisors` (`company_code`,`code`);--> statement-breakpoint
ALTER TABLE `salesmen` ADD `supervisor_id` integer REFERENCES sales_supervisors(id);