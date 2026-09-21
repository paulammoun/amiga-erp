type ReceiptAllocation={receiptNumber:string;invoiceId:number;amount:number;amountReceiptCurrency:number};
type AdvanceApplication={receiptId:number;invoiceId:number;applicationDate:string;amount:number;amountReceiptCurrency:number;requestKey:string;requestHash:string};

const invoiceRemaining=`ROUND(invoice.total-
  COALESCE((SELECT SUM(amount) FROM receipt_invoice_allocations WHERE invoice_id=invoice.id),0)-
  COALESCE((SELECT SUM(amount) FROM customer_advance_applications WHERE invoice_id=invoice.id),0),2)+0.00001`;
const receiptRemaining=`ROUND(receipt.amount-
  COALESCE((SELECT SUM(amount_receipt_currency) FROM receipt_invoice_allocations WHERE receipt_id=receipt.id),0)-
  COALESCE((SELECT SUM(amount_receipt_currency) FROM customer_advance_applications WHERE receipt_id=receipt.id),0),2)+0.00001`;

/** The CASE writes NULL to a required column when a concurrent allocation consumed either balance.
 * D1 then aborts the entire batch, so a receipt, its accounting and allocations cannot split apart.
 */
export function guardedReceiptAllocation(db:D1Database,company:string,value:ReceiptAllocation){
 return db.prepare(`WITH receipt AS (
   SELECT id,customer_id,amount FROM customer_receipts WHERE receipt_number=? AND company_code=?
  ),invoice AS (
   SELECT id,customer_id,total FROM invoices WHERE id=? AND company_code=?
  )
  INSERT INTO receipt_invoice_allocations(company_code,receipt_id,invoice_id,amount,amount_receipt_currency)
  SELECT ?,receipt.id,invoice.id,
   CASE WHEN receipt.customer_id=invoice.customer_id AND ?<=${invoiceRemaining} AND ?<=${receiptRemaining} THEN ? ELSE NULL END,?
  FROM (SELECT 1) guard LEFT JOIN receipt ON 1=1 LEFT JOIN invoice ON 1=1`)
  .bind(value.receiptNumber,company,value.invoiceId,company,company,value.amount,value.amountReceiptCurrency,value.amount,value.amountReceiptCurrency);
}

export function guardedAdvanceApplication(db:D1Database,company:string,value:AdvanceApplication){
 return db.prepare(`WITH receipt AS (
   SELECT id,customer_id,amount FROM customer_receipts WHERE id=? AND company_code=?
  ),invoice AS (
   SELECT id,customer_id,total FROM invoices WHERE id=? AND company_code=?
  )
  INSERT INTO customer_advance_applications(company_code,receipt_id,invoice_id,application_date,amount,amount_receipt_currency,request_key,request_hash)
  SELECT ?,receipt.id,invoice.id,?,
   CASE WHEN receipt.customer_id=invoice.customer_id AND ?<=${invoiceRemaining} AND ?<=${receiptRemaining} THEN ? ELSE NULL END,?,?,?
  FROM (SELECT 1) guard LEFT JOIN receipt ON 1=1 LEFT JOIN invoice ON 1=1`)
  .bind(value.receiptId,company,value.invoiceId,company,company,value.applicationDate,value.amount,value.amountReceiptCurrency,value.amount,value.amountReceiptCurrency,value.requestKey,value.requestHash);
}
