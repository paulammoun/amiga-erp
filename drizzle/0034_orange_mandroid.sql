ALTER TABLE `invoice_lines` ADD `line_discount_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_lines` ADD `line_discount_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `line_discount_total` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `calculation_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `discount_rate` real DEFAULT 0 NOT NULL;