CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`line_type` text NOT NULL,
	`item_id` integer,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`line_total` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`vehicle` text DEFAULT '' NOT NULL,
	`plate_number` text DEFAULT '' NOT NULL,
	`mileage` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`stock_qty` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_sku_unique` ON `items` (`sku`);