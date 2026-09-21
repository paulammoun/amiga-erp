CREATE TABLE `item_barcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`item_id` integer NOT NULL,
	`code` text NOT NULL,
	`unit` text NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_barcodes_company_code` ON `item_barcodes` (`company_code`,`code`);--> statement-breakpoint
CREATE INDEX `item_barcodes_item` ON `item_barcodes` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_master_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_master_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_master_values_unique` ON `item_master_values` (`company_code`,`category`,`parent`,`name`);--> statement-breakpoint
ALTER TABLE `invoice_lines` ADD `unit_factor` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `master_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `master_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoice_lines` ADD `unit_factor` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoice_lines` ADD `unit` text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD `unit_factor` real DEFAULT 1 NOT NULL;