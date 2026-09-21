ALTER TABLE `accounting_transactions` ADD `account_id` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `managed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `account_id` integer;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `account_id` integer;--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `customer_account_prefix` text DEFAULT '4111' NOT NULL;--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `supplier_account_prefix` text DEFAULT '4011' NOT NULL;
