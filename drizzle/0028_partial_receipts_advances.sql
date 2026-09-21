ALTER TABLE customer_receipts ADD COLUMN invoice_currency_amount REAL NOT NULL DEFAULT 0;

UPDATE customer_receipts AS r
SET invoice_currency_amount = CASE
  WHEN r.currency=(SELECT default_currency FROM workshop_settings WHERE company_code=r.company_code) THEN ROUND(r.amount,2)
  WHEN r.currency=(SELECT local_currency FROM workshop_settings WHERE company_code=r.company_code) THEN
    COALESCE(
      (SELECT t.amount_currency FROM accounting_transactions t
       WHERE t.company_code=r.company_code AND t.transaction_type='receipt' AND t.source_id=r.id
         AND t.indicator='credit' AND t.currency=(SELECT default_currency FROM workshop_settings WHERE company_code=r.company_code)
       LIMIT 1),
      ROUND(r.amount / NULLIF((SELECT local_currency_rate FROM workshop_settings WHERE company_code=r.company_code),0),2),
      0
    )
  ELSE 0
END
WHERE r.account_number<>'';
UPDATE customer_receipts AS r
SET invoice_currency_amount=MAX(r.invoice_currency_amount,
  COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.receipt_id=r.id),0));

CREATE TABLE customer_advance_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  receipt_id INTEGER NOT NULL REFERENCES customer_receipts(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  application_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_advance_applications_receipt ON customer_advance_applications(company_code,receipt_id);
CREATE INDEX idx_advance_applications_invoice ON customer_advance_applications(company_code,invoice_id);

DROP TRIGGER receipt_allocations_guard;
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

DROP TRIGGER invoice_allocations_guard;
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

UPDATE invoices AS i
SET status=CASE WHEN ROUND(i.total
  -COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.invoice_id=i.id),0)
  -COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.invoice_id=i.id),0),2)<=0
  THEN 'paid' ELSE 'unpaid' END
WHERE EXISTS(SELECT 1 FROM receipt_invoice_allocations WHERE invoice_id=i.id)
  OR EXISTS(SELECT 1 FROM customer_advance_applications WHERE invoice_id=i.id);
