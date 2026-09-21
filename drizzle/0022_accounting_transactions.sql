ALTER TABLE purchase_invoices ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN tax REAL NOT NULL DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN total REAL NOT NULL DEFAULT 0;
UPDATE purchase_invoices SET total=subtotal WHERE total=0;

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
);
CREATE INDEX idx_accounting_company_date ON accounting_transactions(company_code,transaction_date,id);

INSERT INTO workshop_settings(company_code,company_name)
SELECT lower(code),name FROM companies
WHERE NOT EXISTS(SELECT 1 FROM workshop_settings WHERE company_code=lower(companies.code));

INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
SELECT i.company_code,'sale',i.id,substr(i.created_at,1,10),c.account_number,s.default_currency,i.invoice_number,i.total,CASE WHEN s.default_currency=s.local_currency THEN i.total ELSE ROUND(i.total*s.local_currency_rate,2) END,'debit','Customer receivable' FROM invoices i JOIN customers c ON c.id=i.customer_id AND c.company_code=i.company_code JOIN workshop_settings s ON s.company_code=i.company_code;
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
SELECT i.company_code,'sale',i.id,substr(i.created_at,1,10),s.sales_account_number,s.default_currency,i.invoice_number,i.subtotal,CASE WHEN s.default_currency=s.local_currency THEN i.subtotal ELSE ROUND(i.subtotal*s.local_currency_rate,2) END,'credit','Sales revenue' FROM invoices i JOIN workshop_settings s ON s.company_code=i.company_code;
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
SELECT i.company_code,'sale',i.id,substr(i.created_at,1,10),s.tax_account_number,s.default_currency,i.invoice_number,i.tax,CASE WHEN s.default_currency=s.local_currency THEN i.tax ELSE ROUND(i.tax*s.local_currency_rate,2) END,'credit','Sales tax' FROM invoices i JOIN workshop_settings s ON s.company_code=i.company_code WHERE i.tax<>0;
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
SELECT p.company_code,'purchase',p.id,p.purchase_date,s.purchase_account_number,p.currency,p.purchase_number,p.subtotal,CASE WHEN p.currency=s.local_currency THEN p.subtotal ELSE ROUND(p.subtotal*s.local_currency_rate,2) END,'debit','Purchases' FROM purchase_invoices p JOIN workshop_settings s ON s.company_code=p.company_code;
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
SELECT p.company_code,'purchase',p.id,p.purchase_date,sup.account_number,p.currency,p.purchase_number,p.total,CASE WHEN p.currency=s.local_currency THEN p.total ELSE ROUND(p.total*s.local_currency_rate,2) END,'credit','Supplier payable' FROM purchase_invoices p JOIN suppliers sup ON sup.id=p.supplier_id AND sup.company_code=p.company_code JOIN workshop_settings s ON s.company_code=p.company_code;
