ALTER TABLE customer_receipts ADD COLUMN account_number TEXT NOT NULL DEFAULT '';

CREATE TABLE receipt_invoice_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  receipt_id INTEGER NOT NULL REFERENCES customer_receipts(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL CHECK(amount > 0)
);
CREATE UNIQUE INDEX receipt_allocations_receipt_invoice_unique ON receipt_invoice_allocations(receipt_id, invoice_id);
CREATE INDEX idx_receipt_allocations_invoice ON receipt_invoice_allocations(company_code, invoice_id);
CREATE UNIQUE INDEX idx_receipt_accounting_unique ON accounting_transactions(company_code, source_id, indicator) WHERE transaction_type='receipt';

CREATE TRIGGER receipt_allocations_guard BEFORE INSERT ON receipt_invoice_allocations
BEGIN
  SELECT RAISE(ABORT, 'Receipt and invoice must belong to the same customer and company')
  WHERE NOT EXISTS (
    SELECT 1 FROM customer_receipts r JOIN invoices i ON i.customer_id=r.customer_id AND i.company_code=r.company_code
    WHERE r.id=NEW.receipt_id AND i.id=NEW.invoice_id AND r.company_code=NEW.company_code
  );
  SELECT RAISE(ABORT, 'Invoice allocation exceeds its outstanding amount')
  WHERE NEW.amount > (
    SELECT ROUND(i.total-COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.invoice_id=i.id),0),2)
    FROM invoices i WHERE i.id=NEW.invoice_id
  )+0.00001;
END;

CREATE TRIGGER invoice_allocations_guard BEFORE UPDATE OF total, customer_id, company_code ON invoices
WHEN EXISTS(SELECT 1 FROM receipt_invoice_allocations WHERE invoice_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Cannot change the customer of an invoice with receipts')
  WHERE NEW.customer_id<>OLD.customer_id OR NEW.company_code<>OLD.company_code;
  SELECT RAISE(ABORT, 'Invoice total cannot be less than its received amount')
  WHERE NEW.total+0.00001 < (SELECT SUM(amount) FROM receipt_invoice_allocations WHERE invoice_id=OLD.id);
END;
