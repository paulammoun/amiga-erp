CREATE TABLE `invoice_edit_guards` (
	`invoice_id` integer PRIMARY KEY NOT NULL,
	`expected_revision` integer NOT NULL,
	`edit_token` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
