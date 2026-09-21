ALTER TABLE invoices ADD COLUMN invoice_date TEXT NOT NULL DEFAULT '';
UPDATE invoices SET invoice_date=substr(created_at,1,10) WHERE invoice_date='';
CREATE INDEX idx_invoices_company_date ON invoices(company_code,invoice_date);
