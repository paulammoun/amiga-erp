CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_code` text,
	`name` text NOT NULL,
	`mof_number` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_supplier_code_unique` ON `suppliers` (`supplier_code`);
--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `supplier_id` integer REFERENCES `suppliers`(`id`);
