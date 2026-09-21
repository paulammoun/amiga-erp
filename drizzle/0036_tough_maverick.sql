CREATE TABLE `document_sequences` (
	`company_code` text NOT NULL,
	`document_type` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_sequences_company_type_unique` ON `document_sequences` (`company_code`,`document_type`);--> statement-breakpoint
CREATE TABLE `payment_status_reconciliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`invoice_id` integer NOT NULL,
	`legacy_status` text NOT NULL,
	`calculated_status` text NOT NULL,
	`reason` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_reconciliations_invoice_unique` ON `payment_status_reconciliations` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_reconciliations_company` ON `payment_status_reconciliations` (`company_code`,`resolved`);--> statement-breakpoint
ALTER TABLE `customer_advance_applications` ADD `amount_receipt_currency` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_advance_applications` ADD `request_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_advance_applications` ADD `request_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `advance_applications_company_request_unique` ON `customer_advance_applications` (`company_code`,`request_key`) WHERE "customer_advance_applications"."request_key" <> '';--> statement-breakpoint
ALTER TABLE `customer_receipts` ADD `currency_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_receipts` ADD `request_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_receipts` ADD `request_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_company_request_unique` ON `customer_receipts` (`company_code`,`request_key`) WHERE "customer_receipts"."request_key" <> '';--> statement-breakpoint
ALTER TABLE `invoices` ADD `local_currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payment_terms` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `due_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `seller_company_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `seller_company_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `seller_tax_registration` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `seller_logo_data_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_trading_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_mof_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_mobile` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `salesman_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `salesman_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `historical_fallbacks` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `snapshot_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `edit_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `request_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `request_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_company_request_unique` ON `invoices` (`company_code`,`request_key`) WHERE "invoices"."request_key" <> '';--> statement-breakpoint
ALTER TABLE `receipt_invoice_allocations` ADD `amount_receipt_currency` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `seller_tax_registration` text DEFAULT '' NOT NULL;
