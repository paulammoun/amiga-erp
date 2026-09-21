-- Reference schema derived from all migrations on a fresh empty database.
-- Do not apply this in addition to the migrations. Contains no row data.

CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `customer_code` text, `mof_number` text DEFAULT '' NOT NULL, `company_code` text NOT NULL DEFAULT 'default', account_number TEXT NOT NULL DEFAULT '', salesman_id INTEGER REFERENCES salesmen(id), price_list_id INTEGER REFERENCES price_lists(id), status TEXT NOT NULL DEFAULT 'active', trading_name TEXT NOT NULL DEFAULT '', customer_type TEXT NOT NULL DEFAULT 'individual', company_registration_number TEXT NOT NULL DEFAULT '', preferred_language TEXT NOT NULL DEFAULT 'English', mobile TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT 'Lebanon', default_currency TEXT NOT NULL DEFAULT 'USD', payment_terms TEXT NOT NULL DEFAULT 'cash', credit_limit REAL NOT NULL DEFAULT 0, default_discount REAL NOT NULL DEFAULT 0, customer_group TEXT NOT NULL DEFAULT 'retail', territory TEXT NOT NULL DEFAULT '', default_payment_method TEXT NOT NULL DEFAULT 'cash', vat_treatment TEXT NOT NULL DEFAULT 'standard', tax_registration_status TEXT NOT NULL DEFAULT 'not_registered', statement_delivery TEXT NOT NULL DEFAULT 'on_request', statement_email TEXT NOT NULL DEFAULT '', allow_credit_sales INTEGER NOT NULL DEFAULT 1, apply_withholding_tax INTEGER NOT NULL DEFAULT 0, credit_hold INTEGER NOT NULL DEFAULT 0, block_invoices INTEGER NOT NULL DEFAULT 0, warn_credit_limit INTEGER NOT NULL DEFAULT 1, require_po_number INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '', acquisition_source TEXT NOT NULL DEFAULT '', internal_notes TEXT NOT NULL DEFAULT '', `account_id` integer);

CREATE TABLE `invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`line_type` text NOT NULL,
	`item_id` integer,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`line_total` real DEFAULT 0 NOT NULL, tax_rate REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0, `discount_amount` real DEFAULT 0 NOT NULL, `line_discount_rate` real DEFAULT 0 NOT NULL, `line_discount_amount` real DEFAULT 0 NOT NULL, sales_order_line_id INTEGER REFERENCES sales_order_lines(id), unit TEXT NOT NULL DEFAULT 'unit', `unit_factor` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`vehicle` text DEFAULT '' NOT NULL,
	`plate_number` text DEFAULT '' NOT NULL,
	`mileage` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `tax_rate` real, `company_code` text NOT NULL DEFAULT 'default', invoice_date TEXT NOT NULL DEFAULT '', purchase_order_number TEXT NOT NULL DEFAULT '', `discount_rate` real DEFAULT 0 NOT NULL, `discount_amount` real DEFAULT 0 NOT NULL, `line_discount_total` real DEFAULT 0 NOT NULL, `calculation_version` integer DEFAULT 0 NOT NULL, `salesman_id` integer REFERENCES salesmen(id), `currency` text DEFAULT '' NOT NULL, `currency_rate` real DEFAULT 0 NOT NULL, `local_currency` text DEFAULT '' NOT NULL, `payment_terms` text DEFAULT '' NOT NULL, `due_date` text DEFAULT '' NOT NULL, `seller_company_name` text DEFAULT '' NOT NULL, `seller_company_address` text DEFAULT '' NOT NULL, `seller_tax_registration` text DEFAULT '' NOT NULL, `seller_logo_data_url` text DEFAULT '' NOT NULL, `customer_code` text DEFAULT '' NOT NULL, `customer_name` text DEFAULT '' NOT NULL, `customer_trading_name` text DEFAULT '' NOT NULL, `customer_mof_number` text DEFAULT '' NOT NULL, `customer_phone` text DEFAULT '' NOT NULL, `customer_mobile` text DEFAULT '' NOT NULL, `customer_email` text DEFAULT '' NOT NULL, `customer_address` text DEFAULT '' NOT NULL, `customer_city` text DEFAULT '' NOT NULL, `customer_country` text DEFAULT '' NOT NULL, `salesman_code` text DEFAULT '' NOT NULL, `salesman_name` text DEFAULT '' NOT NULL, `historical_fallbacks` text DEFAULT '' NOT NULL, `snapshot_version` integer DEFAULT 0 NOT NULL, `revision` integer DEFAULT 1 NOT NULL, `edit_token` text DEFAULT '' NOT NULL, `request_key` text DEFAULT '' NOT NULL, `request_hash` text DEFAULT '' NOT NULL, `updated_at` text DEFAULT '' NOT NULL, `document_state` text DEFAULT 'posted' NOT NULL, `draft_number` text DEFAULT '' NOT NULL, `created_by` text DEFAULT '' NOT NULL, `posted_by` text DEFAULT '' NOT NULL, `posted_at` text DEFAULT '' NOT NULL, `reversed_by` text DEFAULT '' NOT NULL, `reversed_at` text DEFAULT '' NOT NULL, `correction_reason` text DEFAULT '' NOT NULL, `post_request_key` text DEFAULT '' NOT NULL, `post_request_hash` text DEFAULT '' NOT NULL, sales_order_id INTEGER REFERENCES sales_orders(id), sales_order_revision INTEGER, `warehouse_code` text DEFAULT 'MAIN' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`stock_qty` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `company_code` text NOT NULL DEFAULT 'default', vat_rate REAL NOT NULL DEFAULT 0, `discount_rate` real DEFAULT 0 NOT NULL, `active` integer DEFAULT 1 NOT NULL, `master_json` text DEFAULT '{}' NOT NULL, `master_revision` integer DEFAULT 0 NOT NULL);

CREATE TABLE `workshop_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`company_name` text DEFAULT 'Auto Workshop' NOT NULL,
	`company_address` text DEFAULT '' NOT NULL,
	`default_tax` real DEFAULT 11 NOT NULL,
	`default_currency` text DEFAULT 'USD' NOT NULL,
	`local_currency_rate` real DEFAULT 1 NOT NULL,
	`local_currency` text DEFAULT 'USD' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `menu_name` text DEFAULT 'Workshop' NOT NULL, `menu_subtitle` text DEFAULT 'Service desk' NOT NULL, `logo_data_url` text DEFAULT '' NOT NULL, `company_code` text NOT NULL DEFAULT 'default', `overview_kicker` text DEFAULT 'BUSINESS DESK' NOT NULL, `overview_title` text DEFAULT 'Ready for your next sale.' NOT NULL, `overview_description` text DEFAULT 'Create invoices, track items and serve customers from one place.' NOT NULL, sales_account_number TEXT NOT NULL DEFAULT '', tax_account_number TEXT NOT NULL DEFAULT '', purchase_account_number TEXT NOT NULL DEFAULT '', purchase_tax_account_number TEXT NOT NULL DEFAULT '', `seller_tax_registration` text DEFAULT '' NOT NULL, `negative_stock_policy` text DEFAULT 'warn' NOT NULL, `customer_account_prefix` text DEFAULT '4111' NOT NULL, `supplier_account_prefix` text DEFAULT '4011' NOT NULL);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `company_code` text NOT NULL DEFAULT 'DEFAULT');

CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_date` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `company_code` text NOT NULL DEFAULT 'default');

CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `company_code` text NOT NULL DEFAULT 'default');

CREATE TABLE `purchase_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_number` text NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_invoice_number` text DEFAULT '' NOT NULL,
	`purchase_date` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `supplier_id` integer REFERENCES `suppliers`(`id`), `company_code` text NOT NULL DEFAULT 'default', tax_rate REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, `expenses_json` text DEFAULT '[]' NOT NULL, `currency_rate` real, `local_currency` text DEFAULT '' NOT NULL, `expense_percent` real DEFAULT 0 NOT NULL, `expenses_local` real DEFAULT 0 NOT NULL, `tax_override` real, `lbp_rate` real, `total_lbp` real, `warehouse_code` text DEFAULT 'MAIN' NOT NULL);

CREATE TABLE `purchase_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_invoice_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` real NOT NULL,
	`line_total` real NOT NULL, `unit_factor` real DEFAULT 1 NOT NULL, `unit` text DEFAULT 'unit' NOT NULL, `landed_unit_cost` real,
	FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_code` text,
	`name` text NOT NULL,
	`mof_number` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `company_code` text NOT NULL DEFAULT 'default', account_number TEXT NOT NULL DEFAULT '', `account_id` integer);

CREATE TABLE `companies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `customer_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text DEFAULT 'default' NOT NULL,
	`receipt_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`receipt_date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, account_number TEXT NOT NULL DEFAULT '', invoice_currency_amount REAL NOT NULL DEFAULT 0, `currency_rate` real DEFAULT 0 NOT NULL, `request_key` text DEFAULT '' NOT NULL, `request_hash` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE stock_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 item_id INTEGER NOT NULL,
 transaction_type TEXT NOT NULL,
 source_id INTEGER,
 source_line_id INTEGER,
 reference TEXT NOT NULL DEFAULT '',
 transaction_date TEXT NOT NULL,
 quantity REAL NOT NULL,
 unit_cost REAL,
 currency TEXT,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, unit_sale_price REAL, `warehouse_code` text DEFAULT 'MAIN' NOT NULL);

CREATE TABLE accounting_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 transaction_type TEXT NOT NULL,
 source_id INTEGER NOT NULL,
 transaction_date TEXT NOT NULL,
 account_number TEXT NOT NULL DEFAULT '',
 currency TEXT NOT NULL,
 reference TEXT NOT NULL,
 amount_currency REAL NOT NULL,
 amount_local_currency REAL NOT NULL,
 indicator TEXT NOT NULL CHECK(indicator IN ('debit','credit')),
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, `account_id` integer);

CREATE TABLE accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 account_number TEXT NOT NULL,
 name TEXT NOT NULL,
 account_type TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD',
 active INTEGER NOT NULL DEFAULT 1,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, `managed` integer DEFAULT 0 NOT NULL);

CREATE TABLE journal_vouchers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 voucher_number TEXT NOT NULL,
 voucher_date TEXT NOT NULL,
 currency TEXT NOT NULL,
 external_reference TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salesmen (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 salesman_code TEXT NOT NULL,
 name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE receipt_invoice_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  receipt_id INTEGER NOT NULL REFERENCES customer_receipts(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL CHECK(amount > 0)
, `amount_receipt_currency` real DEFAULT 0 NOT NULL);

CREATE TABLE customer_advance_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  receipt_id INTEGER NOT NULL REFERENCES customer_receipts(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  application_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, `amount_receipt_currency` real DEFAULT 0 NOT NULL, `request_key` text DEFAULT '' NOT NULL, `request_hash` text DEFAULT '' NOT NULL);

CREATE TABLE price_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  price_list_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE customer_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  receives TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'service',
  label TEXT NOT NULL DEFAULT '',
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Lebanon',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE customer_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  plate_number TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',
  vehicle_year INTEGER,
  mileage INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE customer_master_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  company_code TEXT NOT NULL,
  category TEXT NOT NULL,
  value_code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `currencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `document_sequences` (
	`company_code` text NOT NULL,
	`document_type` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);

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

CREATE TABLE `invoice_edit_guards` (
	`invoice_id` integer PRIMARY KEY NOT NULL,
	`expected_revision` integer NOT NULL,
	`edit_token` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `invoice_posting_guards` (
  `invoice_id` integer PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);

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
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `workflow` text DEFAULT 'legacy' NOT NULL, `notes` text DEFAULT '' NOT NULL, `edit_token` text DEFAULT '' NOT NULL, `local_subtotal` real DEFAULT 0 NOT NULL, `local_tax` real DEFAULT 0 NOT NULL, `local_total` real DEFAULT 0 NOT NULL, `warehouse_code` text DEFAULT 'MAIN' NOT NULL,
  FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);

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
  `total` real NOT NULL, `gross_amount` real DEFAULT 0 NOT NULL, `line_discount_amount` real DEFAULT 0 NOT NULL, `invoice_discount_amount` real DEFAULT 0 NOT NULL,
  FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`original_invoice_line_id`) REFERENCES `invoice_lines`(`id`) ON UPDATE no action ON DELETE no action
);

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

CREATE TABLE `sales_return_guards` (`token` text PRIMARY KEY NOT NULL, `valid` integer NOT NULL);

CREATE TABLE sales_orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_code TEXT NOT NULL, order_number TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','confirmed','cancelled')), revision INTEGER NOT NULL DEFAULT 1,
 customer_id INTEGER NOT NULL REFERENCES customers(id), customer_name TEXT NOT NULL, customer_snapshot TEXT NOT NULL,
 order_date TEXT NOT NULL, expected_delivery_date TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL, payment_terms TEXT NOT NULL,
 purchase_order_number TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', discount_rate REAL NOT NULL DEFAULT 0,
 total REAL NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, `warehouse_code` text DEFAULT 'MAIN' NOT NULL);

CREATE TABLE sales_order_lines (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id), line_type TEXT NOT NULL,
 item_id INTEGER REFERENCES items(id), description TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'unit',
 quantity REAL NOT NULL CHECK(quantity>0), unit_price REAL NOT NULL CHECK(unit_price>=0),
 line_discount_rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0
, `unit_factor` real DEFAULT 1 NOT NULL);

CREATE TABLE sales_order_guards (token TEXT PRIMARY KEY NOT NULL, valid INTEGER NOT NULL);

CREATE TABLE sales_order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id), action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE `item_barcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`item_id` integer NOT NULL,
	`code` text NOT NULL,
	`unit` text NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `item_master_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL
);

CREATE TABLE `item_master_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);

CREATE TABLE `warehouses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);

CREATE TABLE `report_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_code` text NOT NULL,
	`user_id` integer NOT NULL,
	`report_id` text NOT NULL,
	`name` text NOT NULL,
	`filters_json` text NOT NULL
);

CREATE TABLE `coa_posting_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`max_id` integer NOT NULL,
	`valid` integer NOT NULL
);

CREATE TABLE `coa_write_guards` (
	`token` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL
);

CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);

CREATE UNIQUE INDEX `users_username_normalized_unique` ON `users` (`username_normalized`);

CREATE UNIQUE INDEX `companies_code_unique` ON `companies` (`code`);

CREATE UNIQUE INDEX `items_company_sku_unique` ON `items` (`company_code`,`sku`);

CREATE UNIQUE INDEX `customers_company_code_unique` ON `customers` (`company_code`,`customer_code`);

CREATE UNIQUE INDEX `invoices_company_number_unique` ON `invoices` (`company_code`,`invoice_number`);

CREATE UNIQUE INDEX `suppliers_company_code_unique` ON `suppliers` (`company_code`,`supplier_code`);

CREATE UNIQUE INDEX `purchases_company_number_unique` ON `purchase_invoices` (`company_code`,`purchase_number`);

CREATE INDEX `idx_expenses_company_date` ON `expenses` (`company_code`,`expense_date`);

CREATE UNIQUE INDEX `expense_categories_company_name_unique` ON `expense_categories` (`company_code`,`name`);

CREATE UNIQUE INDEX `workshop_settings_company_unique` ON `workshop_settings` (`company_code`);

CREATE INDEX `idx_items_company` ON `items` (`company_code`);

CREATE INDEX `idx_customers_company` ON `customers` (`company_code`);

CREATE INDEX `idx_invoices_company` ON `invoices` (`company_code`);

CREATE INDEX `idx_suppliers_company` ON `suppliers` (`company_code`);

CREATE INDEX `idx_purchases_company` ON `purchase_invoices` (`company_code`);

CREATE INDEX `idx_expense_categories_company` ON `expense_categories` (`company_code`);

CREATE UNIQUE INDEX `receipts_company_number_unique` ON `customer_receipts` (`company_code`,`receipt_number`);

CREATE INDEX `idx_receipts_company_date` ON `customer_receipts` (`company_code`,`receipt_date`);

CREATE INDEX `idx_receipts_customer` ON `customer_receipts` (`customer_id`);

CREATE INDEX customers_company_account_number_index
ON customers (company_code, account_number);

CREATE INDEX suppliers_company_account_number_index
ON suppliers (company_code, account_number);

CREATE INDEX idx_accounting_company_date ON accounting_transactions(company_code,transaction_date,id);

CREATE UNIQUE INDEX accounts_company_number_unique ON accounts(company_code,account_number);

CREATE INDEX idx_accounts_company_name ON accounts(company_code,name);

CREATE UNIQUE INDEX journal_vouchers_company_number_unique ON journal_vouchers(company_code,voucher_number);

CREATE INDEX idx_journal_vouchers_company_date ON journal_vouchers(company_code,voucher_date);

CREATE UNIQUE INDEX salesmen_company_code_unique ON salesmen(company_code,salesman_code);

CREATE INDEX idx_salesmen_company_name ON salesmen(company_code,name);

CREATE INDEX idx_customers_company_salesman ON customers(company_code,salesman_id);

CREATE INDEX idx_invoices_company_date ON invoices(company_code,invoice_date);

CREATE UNIQUE INDEX receipt_allocations_receipt_invoice_unique ON receipt_invoice_allocations(receipt_id, invoice_id);

CREATE INDEX idx_receipt_allocations_invoice ON receipt_invoice_allocations(company_code, invoice_id);

CREATE UNIQUE INDEX idx_receipt_accounting_unique ON accounting_transactions(company_code, source_id, indicator) WHERE transaction_type='receipt';

CREATE INDEX idx_advance_applications_receipt ON customer_advance_applications(company_code,receipt_id);

CREATE INDEX idx_advance_applications_invoice ON customer_advance_applications(company_code,invoice_id);

CREATE UNIQUE INDEX price_lists_company_code_unique
ON price_lists(company_code, code);

CREATE INDEX idx_price_lists_company_name
ON price_lists(company_code, name);

CREATE UNIQUE INDEX price_list_items_list_item_unique
ON price_list_items(price_list_id, item_id);

CREATE INDEX idx_price_list_items_item
ON price_list_items(item_id);

CREATE INDEX idx_customers_price_list
ON customers(price_list_id);

CREATE INDEX idx_customer_contacts_customer
ON customer_contacts(company_code, customer_id);

CREATE INDEX idx_customer_addresses_customer
ON customer_addresses(company_code, customer_id);

CREATE INDEX idx_customer_vehicles_customer
ON customer_vehicles(company_code, customer_id);

CREATE INDEX idx_customer_vehicles_plate
ON customer_vehicles(company_code, plate_number);

CREATE UNIQUE INDEX customer_master_values_company_category_code_unique
ON customer_master_values(company_code, category, value_code);

CREATE INDEX idx_customer_master_values_company_category
ON customer_master_values(company_code, category, sort_order, name);

CREATE UNIQUE INDEX `currencies_company_code_unique` ON `currencies` (`company_code`,`code`);

CREATE INDEX `idx_currencies_company_name` ON `currencies` (`company_code`,`name`);

CREATE UNIQUE INDEX `document_sequences_company_type_unique` ON `document_sequences` (`company_code`,`document_type`);

CREATE UNIQUE INDEX `payment_reconciliations_invoice_unique` ON `payment_status_reconciliations` (`invoice_id`);

CREATE INDEX `idx_payment_reconciliations_company` ON `payment_status_reconciliations` (`company_code`,`resolved`);

CREATE UNIQUE INDEX `advance_applications_company_request_unique` ON `customer_advance_applications` (`company_code`,`request_key`) WHERE "customer_advance_applications"."request_key" <> '';

CREATE UNIQUE INDEX `receipts_company_request_unique` ON `customer_receipts` (`company_code`,`request_key`) WHERE "customer_receipts"."request_key" <> '';

CREATE UNIQUE INDEX `invoices_company_request_unique` ON `invoices` (`company_code`,`request_key`) WHERE "invoices"."request_key" <> '';

CREATE UNIQUE INDEX `credit_notes_company_number_unique` ON `credit_notes` (`company_code`,`credit_number`);

CREATE UNIQUE INDEX `credit_notes_company_draft_unique` ON `credit_notes` (`company_code`,`draft_number`);

CREATE UNIQUE INDEX `credit_notes_company_request_unique` ON `credit_notes` (`company_code`,`request_key`);

CREATE INDEX `idx_credit_notes_original` ON `credit_notes` (`company_code`,`original_invoice_id`);

CREATE INDEX `idx_credit_applications_note` ON `credit_note_applications` (`company_code`,`credit_note_id`);

CREATE INDEX `idx_credit_applications_invoice` ON `credit_note_applications` (`company_code`,`invoice_id`);

CREATE UNIQUE INDEX `credit_applications_request_unique` ON `credit_note_applications` (`company_code`,`request_key`) WHERE `request_key` <> '';

CREATE UNIQUE INDEX sales_orders_company_number ON sales_orders(company_code,order_number);

CREATE UNIQUE INDEX sales_orders_company_request ON sales_orders(company_code,request_key);

CREATE INDEX sales_order_lines_order ON sales_order_lines(order_id);

CREATE INDEX sales_orders_company_date ON sales_orders(company_code,order_date);

CREATE INDEX invoices_sales_order ON invoices(sales_order_id);

CREATE INDEX invoice_lines_sales_order ON invoice_lines(sales_order_line_id);

CREATE UNIQUE INDEX `item_barcodes_company_code` ON `item_barcodes` (`company_code`,`code`);

CREATE INDEX `item_barcodes_item` ON `item_barcodes` (`item_id`);

CREATE UNIQUE INDEX `item_master_values_unique` ON `item_master_values` (`company_code`,`category`,`parent`,`name`);

CREATE UNIQUE INDEX `warehouses_company_code` ON `warehouses` (`company_code`,`code`);

CREATE UNIQUE INDEX `report_presets_owner_name` ON `report_presets` (`company_code`,`user_id`,`report_id`,`name`);

CREATE TRIGGER receipt_allocations_guard BEFORE INSERT ON receipt_invoice_allocations
BEGIN
  SELECT RAISE(ABORT,'Receipt and invoice must belong to the same customer and company')
  WHERE NOT EXISTS(
    SELECT 1 FROM customer_receipts r JOIN invoices i ON i.customer_id=r.customer_id AND i.company_code=r.company_code
    WHERE r.id=NEW.receipt_id AND i.id=NEW.invoice_id AND r.company_code=NEW.company_code AND r.account_number<>''
  );
  SELECT RAISE(ABORT,'Invoice allocation exceeds its outstanding amount')
  WHERE NEW.amount > (
    SELECT ROUND(i.total
      -COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.invoice_id=i.id),0)
      -COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.invoice_id=i.id),0),2)
    FROM invoices i WHERE i.id=NEW.invoice_id
  )+0.00001;
  SELECT RAISE(ABORT,'Receipt applications exceed the amount paid')
  WHERE NEW.amount > (
    SELECT ROUND(r.invoice_currency_amount
      -COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.receipt_id=r.id),0)
      -COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.receipt_id=r.id),0),2)
    FROM customer_receipts r WHERE r.id=NEW.receipt_id
  )+0.00001;
END;

CREATE TRIGGER advance_applications_guard BEFORE INSERT ON customer_advance_applications
BEGIN
  SELECT RAISE(ABORT,'Advance and invoice must belong to the same customer and company')
  WHERE NOT EXISTS(
    SELECT 1 FROM customer_receipts r JOIN invoices i ON i.customer_id=r.customer_id AND i.company_code=r.company_code
    WHERE r.id=NEW.receipt_id AND i.id=NEW.invoice_id AND r.company_code=NEW.company_code AND r.account_number<>''
  );
  SELECT RAISE(ABORT,'Advance exceeds the amount paid in advance')
  WHERE NEW.amount > (
    SELECT ROUND(r.invoice_currency_amount
      -COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.receipt_id=r.id),0)
      -COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.receipt_id=r.id),0),2)
    FROM customer_receipts r WHERE r.id=NEW.receipt_id
  )+0.00001;
  SELECT RAISE(ABORT,'Advance exceeds the invoice balance')
  WHERE NEW.amount > (
    SELECT ROUND(i.total
      -COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.invoice_id=i.id),0)
      -COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.invoice_id=i.id),0),2)
    FROM invoices i WHERE i.id=NEW.invoice_id
  )+0.00001;
END;

CREATE TRIGGER invoice_allocations_guard BEFORE UPDATE OF total,customer_id,company_code ON invoices
WHEN EXISTS(SELECT 1 FROM receipt_invoice_allocations WHERE invoice_id=OLD.id)
  OR EXISTS(SELECT 1 FROM customer_advance_applications WHERE invoice_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'Cannot change the customer of an invoice with receipts')
  WHERE NEW.customer_id<>OLD.customer_id OR NEW.company_code<>OLD.company_code;
  SELECT RAISE(ABORT,'Invoice total cannot be less than its received amount')
  WHERE NEW.total+0.00001 <
    COALESCE((SELECT SUM(amount) FROM receipt_invoice_allocations WHERE invoice_id=OLD.id),0)
    +COALESCE((SELECT SUM(amount) FROM customer_advance_applications WHERE invoice_id=OLD.id),0);
END;

CREATE TRIGGER receipt_advance_balance_guard BEFORE UPDATE OF invoice_currency_amount,customer_id,company_code ON customer_receipts
WHEN EXISTS(SELECT 1 FROM receipt_invoice_allocations WHERE receipt_id=OLD.id)
  OR EXISTS(SELECT 1 FROM customer_advance_applications WHERE receipt_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'Cannot move a receipt after applying it to invoices')
  WHERE NEW.customer_id<>OLD.customer_id OR NEW.company_code<>OLD.company_code;
  SELECT RAISE(ABORT,'Receipt amount cannot be less than its invoice applications')
  WHERE NEW.invoice_currency_amount+0.00001 <
    COALESCE((SELECT SUM(amount) FROM receipt_invoice_allocations WHERE receipt_id=OLD.id),0)
    +COALESCE((SELECT SUM(amount) FROM customer_advance_applications WHERE receipt_id=OLD.id),0);
END;

CREATE TRIGGER sales_order_link_guard BEFORE UPDATE OF sales_order_id ON invoices WHEN NEW.sales_order_id IS NOT NULL AND OLD.sales_order_id IS NULL BEGIN
 SELECT RAISE(ABORT,'Sales order changed. Refresh before converting.') WHERE NOT EXISTS(SELECT 1 FROM sales_orders o WHERE o.id=NEW.sales_order_id AND o.company_code=NEW.company_code AND o.customer_id=NEW.customer_id AND o.currency=NEW.currency AND o.state='confirmed' AND o.revision=NEW.sales_order_revision);
 UPDATE sales_orders SET revision=revision+1 WHERE id=NEW.sales_order_id;
END;

CREATE TRIGGER sales_order_quantity_guard BEFORE UPDATE OF sales_order_line_id ON invoice_lines WHEN NEW.sales_order_line_id IS NOT NULL AND OLD.sales_order_line_id IS NULL BEGIN
 SELECT RAISE(ABORT,'Quantity exceeds remaining sales order quantity.') WHERE NOT EXISTS(SELECT 1 FROM sales_order_lines l JOIN invoices i ON i.id=NEW.invoice_id WHERE l.id=NEW.sales_order_line_id AND l.order_id=i.sales_order_id AND NEW.quantity>0 AND NEW.quantity<=l.quantity-COALESCE((SELECT SUM(x.quantity) FROM invoice_lines x JOIN invoices xi ON xi.id=x.invoice_id WHERE x.sales_order_line_id=l.id AND xi.document_state IN ('draft','posted','reversed')),0)+0.000000001);
END;

CREATE TRIGGER sales_order_invoice_line_immutable BEFORE UPDATE ON invoice_lines WHEN OLD.sales_order_line_id IS NOT NULL AND (NEW.sales_order_line_id IS NOT OLD.sales_order_line_id OR NEW.quantity<>OLD.quantity OR NEW.unit_price<>OLD.unit_price OR NEW.discount_amount<>OLD.discount_amount OR NEW.tax_amount<>OLD.tax_amount OR NEW.line_discount_amount<>OLD.line_discount_amount OR NEW.item_id IS NOT OLD.item_id OR NEW.description<>OLD.description OR NEW.tax_rate<>OLD.tax_rate OR NEW.line_discount_rate<>OLD.line_discount_rate OR NEW.invoice_id<>OLD.invoice_id OR NEW.line_total<>OLD.line_total) BEGIN
 SELECT RAISE(ABORT,'Order invoice lines are locked. Cancel the draft and convert again.');
END;

CREATE TRIGGER sales_order_invoice_line_delete BEFORE DELETE ON invoice_lines WHEN OLD.sales_order_line_id IS NOT NULL AND EXISTS(SELECT 1 FROM invoices WHERE id=OLD.invoice_id AND document_state<>'cancelled') BEGIN
 SELECT RAISE(ABORT,'Cancel the order invoice draft before deleting its lines.');
END;

CREATE TRIGGER sales_order_invoice_state AFTER UPDATE OF document_state ON invoices WHEN NEW.sales_order_id IS NOT NULL AND NEW.document_state<>OLD.document_state BEGIN
 UPDATE sales_orders SET revision=revision+1 WHERE id=NEW.sales_order_id;
END;

CREATE TRIGGER sales_order_financial_lock BEFORE UPDATE OF customer_id,currency,discount_rate,payment_terms,customer_snapshot ON sales_orders WHEN EXISTS(SELECT 1 FROM invoices WHERE sales_order_id=OLD.id) BEGIN
 SELECT RAISE(ABORT,'An order with invoice history cannot be rewritten.');
END;

CREATE TRIGGER sales_order_line_delete_lock BEFORE DELETE ON sales_order_lines WHEN EXISTS(SELECT 1 FROM invoices WHERE sales_order_id=OLD.order_id) BEGIN
 SELECT RAISE(ABORT,'An order with invoice history cannot be rewritten.');
END;
