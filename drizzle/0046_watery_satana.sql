CREATE TABLE `warehouses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_company_code` ON `warehouses` (`company_code`,`code`);--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `warehouse_code` text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `warehouse_code` text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `warehouse_code` text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `warehouse_code` text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_transactions` ADD `warehouse_code` text DEFAULT 'MAIN' NOT NULL;
