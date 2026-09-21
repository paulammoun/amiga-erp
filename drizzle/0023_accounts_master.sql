CREATE TABLE IF NOT EXISTS accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_code TEXT NOT NULL,
 account_number TEXT NOT NULL,
 name TEXT NOT NULL,
 account_type TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD',
 active INTEGER NOT NULL DEFAULT 1,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_company_number_unique ON accounts(company_code,account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_company_name ON accounts(company_code,name);

INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT customer.company_code,customer.account_number,customer.name || ' (customer)','asset',COALESCE(settings.default_currency,'USD') FROM customers customer LEFT JOIN workshop_settings settings ON settings.company_code=customer.company_code WHERE trim(customer.account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT supplier.company_code,supplier.account_number,supplier.name || ' (supplier)','liability',COALESCE(settings.default_currency,'USD') FROM suppliers supplier LEFT JOIN workshop_settings settings ON settings.company_code=supplier.company_code WHERE trim(supplier.account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT company_code,sales_account_number,'Sales','income',default_currency FROM workshop_settings WHERE trim(sales_account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT company_code,tax_account_number,'Sales tax','liability',default_currency FROM workshop_settings WHERE trim(tax_account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT company_code,purchase_account_number,'Purchases','expense',default_currency FROM workshop_settings WHERE trim(purchase_account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT company_code,purchase_tax_account_number,'Purchase tax','asset',default_currency FROM workshop_settings WHERE trim(purchase_tax_account_number)<>'';
INSERT OR IGNORE INTO accounts (company_code,account_number,name,account_type,currency)
SELECT company_code,account_number,'Imported account','other',currency FROM accounting_transactions WHERE trim(account_number)<>'' GROUP BY company_code,account_number;
