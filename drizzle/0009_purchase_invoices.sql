CREATE TABLE `purchase_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_number` text NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_invoice_number` text DEFAULT '' NOT NULL,
	`purchase_date` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_invoices_purchase_number_unique` ON `purchase_invoices` (`purchase_number`);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_invoice_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
