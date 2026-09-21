ALTER TABLE suppliers ADD COLUMN account_number TEXT NOT NULL DEFAULT '';

CREATE INDEX suppliers_company_account_number_index
ON suppliers (company_code, account_number);
