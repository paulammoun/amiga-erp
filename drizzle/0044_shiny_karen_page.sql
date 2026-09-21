ALTER TABLE `purchase_invoice_lines` ADD `landed_unit_cost` real;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `expenses_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `currency_rate` real;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `local_currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `expense_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `expenses_local` real DEFAULT 0 NOT NULL;