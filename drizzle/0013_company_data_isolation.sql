ALTER TABLE `items` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `items_sku_unique`;
CREATE UNIQUE INDEX `items_company_sku_unique` ON `items` (`company_code`,`sku`);

ALTER TABLE `customers` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `customers_customer_code_unique`;
CREATE UNIQUE INDEX `customers_company_code_unique` ON `customers` (`company_code`,`customer_code`);

ALTER TABLE `invoices` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `invoices_invoice_number_unique`;
CREATE UNIQUE INDEX `invoices_company_number_unique` ON `invoices` (`company_code`,`invoice_number`);

ALTER TABLE `suppliers` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `suppliers_supplier_code_unique`;
CREATE UNIQUE INDEX `suppliers_company_code_unique` ON `suppliers` (`company_code`,`supplier_code`);

ALTER TABLE `purchase_invoices` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `purchase_invoices_purchase_number_unique`;
CREATE UNIQUE INDEX `purchases_company_number_unique` ON `purchase_invoices` (`company_code`,`purchase_number`);

ALTER TABLE `expenses` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
CREATE INDEX `idx_expenses_company_date` ON `expenses` (`company_code`,`expense_date`);

ALTER TABLE `expense_categories` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
DROP INDEX `expense_categories_name_unique`;
CREATE UNIQUE INDEX `expense_categories_company_name_unique` ON `expense_categories` (`company_code`,`name`);

ALTER TABLE `workshop_settings` ADD COLUMN `company_code` text NOT NULL DEFAULT 'default';
CREATE UNIQUE INDEX `workshop_settings_company_unique` ON `workshop_settings` (`company_code`);

CREATE INDEX `idx_items_company` ON `items` (`company_code`);
CREATE INDEX `idx_customers_company` ON `customers` (`company_code`);
CREATE INDEX `idx_invoices_company` ON `invoices` (`company_code`);
CREATE INDEX `idx_suppliers_company` ON `suppliers` (`company_code`);
CREATE INDEX `idx_purchases_company` ON `purchase_invoices` (`company_code`);
CREATE INDEX `idx_expense_categories_company` ON `expense_categories` (`company_code`);
PRAGMA optimize;
