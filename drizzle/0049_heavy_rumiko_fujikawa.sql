CREATE TABLE `coa_posting_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`max_id` integer NOT NULL,
	`valid` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coa_write_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL
);
