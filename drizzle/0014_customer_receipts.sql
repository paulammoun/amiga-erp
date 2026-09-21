CREATE TABLE `customer_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text DEFAULT 'default' NOT NULL,
	`receipt_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`receipt_date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_company_number_unique` ON `customer_receipts` (`company_code`,`receipt_number`);
--> statement-breakpoint
CREATE INDEX `idx_receipts_company_date` ON `customer_receipts` (`company_code`,`receipt_date`);
--> statement-breakpoint
CREATE INDEX `idx_receipts_customer` ON `customer_receipts` (`customer_id`);
--> statement-breakpoint
PRAGMA optimize;
