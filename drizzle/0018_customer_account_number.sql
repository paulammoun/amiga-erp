ALTER TABLE customers ADD COLUMN account_number TEXT NOT NULL DEFAULT '';

CREATE INDEX customers_company_account_number_index
ON customers (company_code, account_number);
