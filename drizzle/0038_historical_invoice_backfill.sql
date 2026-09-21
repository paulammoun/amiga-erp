INSERT OR IGNORE INTO payment_status_reconciliations(company_code,invoice_id,legacy_status,calculated_status,reason)
SELECT i.company_code,i.id,i.status,'unpaid','Legacy invoice was manually marked Paid without a matching receipt or advance allocation.'
FROM invoices i
WHERE i.status='paid' AND i.total>0
  AND ROUND(
    COALESCE((SELECT SUM(amount) FROM receipt_invoice_allocations WHERE invoice_id=i.id),0)+
    COALESCE((SELECT SUM(amount) FROM customer_advance_applications WHERE invoice_id=i.id),0),2
  )=0;
--> statement-breakpoint
UPDATE invoices SET
  currency=COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code),'USD'),
  currency_rate=CASE
    WHEN currency_rate>0 THEN currency_rate
    WHEN COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code))=(SELECT local_currency FROM workshop_settings WHERE company_code=invoices.company_code) THEN 1
    ELSE COALESCE(
      (SELECT rate FROM currencies WHERE company_code=invoices.company_code AND code=COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code))),
      (SELECT local_currency_rate FROM workshop_settings WHERE company_code=invoices.company_code),1
    )
  END,
  local_currency=COALESCE((SELECT local_currency FROM workshop_settings WHERE company_code=invoices.company_code),'USD'),
  payment_terms=COALESCE(NULLIF((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),''),'cash'),
  due_date=COALESCE(
    date(invoice_date,'+'||CASE
      WHEN COALESCE(NULLIF((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),''),'cash') GLOB '*[0-9]*'
      THEN CAST(COALESCE(NULLIF(REPLACE(REPLACE(REPLACE((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),'_days',''),'days',''),'day',''),''),'0') AS INTEGER)
      ELSE 0 END||' days'),
    NULLIF(invoice_date,''),substr(created_at,1,10),'1970-01-01'
  ),
  seller_company_name=COALESCE((SELECT company_name FROM workshop_settings WHERE company_code=invoices.company_code),'Auto Workshop'),
  seller_company_address=COALESCE((SELECT company_address FROM workshop_settings WHERE company_code=invoices.company_code),''),
  seller_tax_registration=COALESCE((SELECT seller_tax_registration FROM workshop_settings WHERE company_code=invoices.company_code),''),
  seller_logo_data_url=COALESCE((SELECT logo_data_url FROM workshop_settings WHERE company_code=invoices.company_code),''),
  customer_code=COALESCE((SELECT COALESCE(customer_code,printf('CUS-%05d',id)) FROM customers WHERE id=invoices.customer_id),''),
  customer_name=COALESCE((SELECT name FROM customers WHERE id=invoices.customer_id),'Customer unavailable'),
  customer_trading_name=COALESCE((SELECT trading_name FROM customers WHERE id=invoices.customer_id),''),
  customer_mof_number=COALESCE((SELECT mof_number FROM customers WHERE id=invoices.customer_id),''),
  customer_phone=COALESCE((SELECT phone FROM customers WHERE id=invoices.customer_id),''),
  customer_mobile=COALESCE((SELECT mobile FROM customers WHERE id=invoices.customer_id),''),
  customer_email=COALESCE((SELECT email FROM customers WHERE id=invoices.customer_id),''),
  customer_address=COALESCE((SELECT address FROM customers WHERE id=invoices.customer_id),''),
  customer_city=COALESCE((SELECT city FROM customers WHERE id=invoices.customer_id),''),
  customer_country=COALESCE((SELECT country FROM customers WHERE id=invoices.customer_id),''),
  salesman_code=COALESCE((SELECT salesman_code FROM salesmen WHERE id=invoices.salesman_id),''),
  salesman_name=COALESCE((SELECT name FROM salesmen WHERE id=invoices.salesman_id),''),
  historical_fallbacks='Seller and customer billing details, payment terms, due date and local currency were recovered from the records available during the Stage 2 migration.'||CASE WHEN currency='' OR currency_rate<=0 THEN ' Invoice currency or exchange rate also used a recorded fallback.' ELSE '' END,
  snapshot_version=1,
  updated_at=COALESCE(NULLIF(updated_at,''),created_at)
WHERE snapshot_version=0;
--> statement-breakpoint
UPDATE customer_receipts SET currency_rate=CASE
  WHEN currency=(SELECT local_currency FROM workshop_settings WHERE company_code=customer_receipts.company_code) THEN 1
  ELSE COALESCE(
    (SELECT rate FROM currencies WHERE company_code=customer_receipts.company_code AND code=customer_receipts.currency),
    (SELECT local_currency_rate FROM workshop_settings WHERE company_code=customer_receipts.company_code),1
  )
END
WHERE currency_rate<=0;
--> statement-breakpoint
UPDATE receipt_invoice_allocations SET amount_receipt_currency=ROUND(
  amount*COALESCE((SELECT currency_rate FROM invoices WHERE id=receipt_invoice_allocations.invoice_id),1)/
  COALESCE(NULLIF((SELECT currency_rate FROM customer_receipts WHERE id=receipt_invoice_allocations.receipt_id),0),1),2
)
WHERE amount_receipt_currency<=0;
--> statement-breakpoint
UPDATE customer_advance_applications SET amount_receipt_currency=ROUND(
  amount*COALESCE((SELECT currency_rate FROM invoices WHERE id=customer_advance_applications.invoice_id),1)/
  COALESCE(NULLIF((SELECT currency_rate FROM customer_receipts WHERE id=customer_advance_applications.receipt_id),0),1),2
)
WHERE amount_receipt_currency<=0;
