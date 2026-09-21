ALTER TABLE `invoice_lines` ADD `discount_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_amount` real DEFAULT 0 NOT NULL;