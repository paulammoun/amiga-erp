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

CREATE UNIQUE INDEX customer_master_values_company_category_code_unique
ON customer_master_values(company_code, category, value_code);

CREATE INDEX idx_customer_master_values_company_category
ON customer_master_values(company_code, category, sort_order, name);

PRAGMA optimize;
