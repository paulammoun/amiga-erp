CREATE TABLE `journal_voucher_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`description` text NOT NULL,
	`prefix` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jv_types_company_prefix_unique` ON `journal_voucher_types` (`company_code`,`prefix`);--> statement-breakpoint
ALTER TABLE `journal_vouchers` ADD `voucher_type_id` integer REFERENCES journal_voucher_types(id);