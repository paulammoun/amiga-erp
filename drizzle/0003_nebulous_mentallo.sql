ALTER TABLE `customers` ADD `customer_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_code_unique` ON `customers` (`customer_code`);--> statement-breakpoint
PRAGMA optimize;
