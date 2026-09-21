CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_name_unique` ON `expense_categories` (`name`);
--> statement-breakpoint
INSERT INTO `expense_categories` (`name`) VALUES ('Parts & supplies'),('Rent'),('Utilities'),('Salaries & wages'),('Fuel'),('Maintenance'),('Insurance'),('Taxes & fees'),('Office expenses'),('Other');
