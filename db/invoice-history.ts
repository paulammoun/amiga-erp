import {getRawDb} from ".";
import {invoiceAppliedSql} from "./receivables";

export async function ensureHistoricalInvoiceValues(companyCode:string,db:D1Database=getRawDb()){
  const company=companyCode.toLowerCase();
  const legacy=await db.prepare("SELECT id FROM invoices WHERE company_code=? AND snapshot_version=0 LIMIT 1").bind(company).first();
  const receiptFallback=await db.prepare("SELECT id FROM customer_receipts WHERE company_code=? AND currency_rate<=0 LIMIT 1").bind(company).first();
  const allocationFallback=await db.prepare(`SELECT 1 AS found FROM receipt_invoice_allocations a JOIN customer_receipts r ON r.id=a.receipt_id WHERE a.company_code=? AND a.amount_receipt_currency<=0
    UNION ALL SELECT 1 FROM customer_advance_applications a JOIN customer_receipts r ON r.id=a.receipt_id WHERE a.company_code=? AND a.amount_receipt_currency<=0 LIMIT 1`).bind(company,company).first();
  const statements:D1PreparedStatement[]=[];
  if(legacy){
    statements.push(
      db.prepare(`INSERT OR IGNORE INTO payment_status_reconciliations(company_code,invoice_id,legacy_status,calculated_status,reason)
        SELECT i.company_code,i.id,i.status,'unpaid','Legacy invoice was manually marked Paid without a matching receipt or advance allocation.'
        FROM invoices i WHERE i.company_code=? AND i.status='paid' AND i.total>0 AND ${invoiceAppliedSql("i.id")}=0`).bind(company),
      db.prepare(`UPDATE invoices SET
        currency=COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code),'USD'),
        currency_rate=CASE WHEN currency_rate>0 THEN currency_rate WHEN COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code))=(SELECT local_currency FROM workshop_settings WHERE company_code=invoices.company_code) THEN 1 ELSE COALESCE((SELECT rate FROM currencies WHERE company_code=invoices.company_code AND code=COALESCE(NULLIF(currency,''),(SELECT default_currency FROM workshop_settings WHERE company_code=invoices.company_code))),(SELECT local_currency_rate FROM workshop_settings WHERE company_code=invoices.company_code),1) END,
        local_currency=COALESCE((SELECT local_currency FROM workshop_settings WHERE company_code=invoices.company_code),'USD'),
        payment_terms=COALESCE((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),'cash'),
        due_date=COALESCE(date(invoice_date,'+'||CASE WHEN COALESCE((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),'cash') GLOB '*[0-9]*' THEN CAST(COALESCE(NULLIF(REPLACE(REPLACE(REPLACE((SELECT payment_terms FROM customers WHERE id=invoices.customer_id),'_days',''),'days',''),'day',''),''),'0') AS INTEGER) ELSE 0 END||' days'),NULLIF(invoice_date,''),substr(created_at,1,10),'1970-01-01'),
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
        snapshot_version=1,updated_at=COALESCE(NULLIF(updated_at,''),created_at)
        WHERE company_code=? AND snapshot_version=0`).bind(company)
    );
  }
  if(receiptFallback)statements.push(db.prepare(`UPDATE customer_receipts SET currency_rate=CASE WHEN currency=(SELECT local_currency FROM workshop_settings WHERE company_code=customer_receipts.company_code) THEN 1 ELSE COALESCE((SELECT rate FROM currencies WHERE company_code=customer_receipts.company_code AND code=customer_receipts.currency),(SELECT local_currency_rate FROM workshop_settings WHERE company_code=customer_receipts.company_code),1) END WHERE company_code=? AND currency_rate<=0`).bind(company));
  if(allocationFallback)statements.push(
    db.prepare(`UPDATE receipt_invoice_allocations SET amount_receipt_currency=ROUND(amount*COALESCE((SELECT currency_rate FROM invoices WHERE id=receipt_invoice_allocations.invoice_id),1)/COALESCE(NULLIF((SELECT currency_rate FROM customer_receipts WHERE id=receipt_invoice_allocations.receipt_id),0),1),2) WHERE company_code=? AND amount_receipt_currency<=0`).bind(company),
    db.prepare(`UPDATE customer_advance_applications SET amount_receipt_currency=ROUND(amount*COALESCE((SELECT currency_rate FROM invoices WHERE id=customer_advance_applications.invoice_id),1)/COALESCE(NULLIF((SELECT currency_rate FROM customer_receipts WHERE id=customer_advance_applications.receipt_id),0),1),2) WHERE company_code=? AND amount_receipt_currency<=0`).bind(company)
  );
  if(statements.length){const results=await db.batch(statements);if(results.some(result=>!result.success))throw new Error("Could not prepare historical invoice values.");}
}
