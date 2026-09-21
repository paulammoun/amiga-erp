-- Earlier lifecycle migrations were hand-authored after snapshot 0037.
-- Apply only the new Sales Return delta; retain all prior records unchanged.
CREATE TABLE `sales_return_guards` (`token` text PRIMARY KEY NOT NULL, `valid` integer NOT NULL);
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `workflow` text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `edit_token` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `local_subtotal` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `local_tax` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_notes` ADD `local_total` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_note_lines` ADD `gross_amount` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_note_lines` ADD `line_discount_amount` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `credit_note_lines` ADD `invoice_discount_amount` real DEFAULT 0 NOT NULL;
