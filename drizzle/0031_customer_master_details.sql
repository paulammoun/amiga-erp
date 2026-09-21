ALTER TABLE customers ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE customers ADD COLUMN trading_name TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE customers ADD COLUMN company_registration_number TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE customers ADD COLUMN mobile TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN country TEXT NOT NULL DEFAULT 'Lebanon';
ALTER TABLE customers ADD COLUMN default_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE customers ADD COLUMN payment_terms TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN default_discount REAL NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN customer_group TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE customers ADD COLUMN territory TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN default_payment_method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE customers ADD COLUMN vat_treatment TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE customers ADD COLUMN tax_registration_status TEXT NOT NULL DEFAULT 'not_registered';
ALTER TABLE customers ADD COLUMN statement_delivery TEXT NOT NULL DEFAULT 'on_request';
ALTER TABLE customers ADD COLUMN statement_email TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN allow_credit_sales INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN apply_withholding_tax INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN credit_hold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN block_invoices INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN warn_credit_limit INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN require_po_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN acquisition_source TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN internal_notes TEXT NOT NULL DEFAULT '';

UPDATE customers
SET default_currency = COALESCE((
  SELECT default_currency
  FROM workshop_settings
  WHERE workshop_settings.company_code = customers.company_code
), 'USD');

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

CREATE INDEX idx_customer_contacts_customer
ON customer_contacts(company_code, customer_id);

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

CREATE INDEX idx_customer_addresses_customer
ON customer_addresses(company_code, customer_id);

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

CREATE INDEX idx_customer_vehicles_customer
ON customer_vehicles(company_code, customer_id);

CREATE INDEX idx_customer_vehicles_plate
ON customer_vehicles(company_code, plate_number);

ALTER TABLE invoices ADD COLUMN purchase_order_number TEXT NOT NULL DEFAULT '';

PRAGMA optimize;
