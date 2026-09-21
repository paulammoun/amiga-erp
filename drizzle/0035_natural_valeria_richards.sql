CREATE TABLE `currencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `currencies_company_code_unique` ON `currencies` (`company_code`,`code`);--> statement-breakpoint
CREATE INDEX `idx_currencies_company_name` ON `currencies` (`company_code`,`name`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `salesman_id` integer REFERENCES salesmen(id);--> statement-breakpoint
ALTER TABLE `invoices` ADD `currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `currency_rate` real DEFAULT 0 NOT NULL;