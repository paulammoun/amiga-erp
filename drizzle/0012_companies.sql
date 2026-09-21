CREATE TABLE IF NOT EXISTS `companies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `companies_code_unique` ON `companies` (`code`);
