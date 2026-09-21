CREATE TABLE `workshop_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`company_name` text DEFAULT 'Auto Workshop' NOT NULL,
	`company_address` text DEFAULT '' NOT NULL,
	`default_tax` real DEFAULT 11 NOT NULL,
	`default_currency` text DEFAULT 'USD' NOT NULL,
	`local_currency_rate` real DEFAULT 1 NOT NULL,
	`local_currency` text DEFAULT 'USD' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
