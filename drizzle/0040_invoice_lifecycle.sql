ALTER TABLE `invoices` ADD `document_state` text DEFAULT 'posted' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `draft_number` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `created_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `posted_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `posted_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `reversed_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `reversed_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `correction_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `post_request_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `post_request_hash` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workshop_settings` ADD `negative_stock_policy` text DEFAULT 'warn' NOT NULL;
--> statement-breakpoint
CREATE TABLE `invoice_posting_guards` (
  `invoice_id` integer PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company_code` text NOT NULL,
  `credit_number` text NOT NULL,
  `draft_number` text NOT NULL,
  `document_state` text DEFAULT 'draft' NOT NULL,
  `original_invoice_id` integer NOT NULL,
  `credit_date` text NOT NULL,
  `customer_id` integer NOT NULL,
  `currency` text NOT NULL,
  `currency_rate` real NOT NULL,
  `local_currency` text NOT NULL,
  `subtotal` real DEFAULT 0 NOT NULL,
  `tax` real DEFAULT 0 NOT NULL,
  `total` real DEFAULT 0 NOT NULL,
  `reason` text NOT NULL,
  `created_by` text NOT NULL,
  `posted_by` text DEFAULT '' NOT NULL,
  `posted_at` text DEFAULT '' NOT NULL,
  `request_key` text NOT NULL,
  `request_hash` text NOT NULL,
  `post_request_key` text DEFAULT '' NOT NULL,
  `post_request_hash` text DEFAULT '' NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_company_number_unique` ON `credit_notes` (`company_code`,`credit_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_company_draft_unique` ON `credit_notes` (`company_code`,`draft_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_company_request_unique` ON `credit_notes` (`company_code`,`request_key`);
--> statement-breakpoint
CREATE INDEX `idx_credit_notes_original` ON `credit_notes` (`company_code`,`original_invoice_id`);
--> statement-breakpoint
CREATE TABLE `credit_note_lines` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `credit_note_id` integer NOT NULL,
  `original_invoice_line_id` integer NOT NULL,
  `description` text NOT NULL,
  `quantity_returned` real DEFAULT 0 NOT NULL,
  `restore_stock` integer DEFAULT false NOT NULL,
  `subtotal` real NOT NULL,
  `tax_rate` real NOT NULL,
  `tax` real NOT NULL,
  `total` real NOT NULL,
  FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`original_invoice_line_id`) REFERENCES `invoice_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credit_note_applications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company_code` text NOT NULL,
  `credit_note_id` integer NOT NULL,
  `invoice_id` integer NOT NULL,
  `application_date` text NOT NULL,
  `amount` real NOT NULL,
  `amount_credit_currency` real DEFAULT 0 NOT NULL,
  `request_key` text DEFAULT '' NOT NULL,
  `request_hash` text DEFAULT '' NOT NULL,
  FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_credit_applications_note` ON `credit_note_applications` (`company_code`,`credit_note_id`);
--> statement-breakpoint
CREATE INDEX `idx_credit_applications_invoice` ON `credit_note_applications` (`company_code`,`invoice_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_applications_request_unique` ON `credit_note_applications` (`company_code`,`request_key`) WHERE `request_key` <> '';
--> statement-breakpoint
UPDATE `invoices` SET
  `document_state`='posted',
  `draft_number`='',
  `created_by`='Migration',
  `posted_by`='Migration',
  `posted_at`=COALESCE(NULLIF(`updated_at`,''),`created_at`)
WHERE `document_state`='posted';
