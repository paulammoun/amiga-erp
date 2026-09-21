import {getRawDb} from './index';

// Every source is scoped at its owning header; child lines never bypass company isolation.
export const reportQueries:Record<string,string>={
 items:'SELECT id,sku,name,brand,active,master_json,sale_price,stock_qty FROM items WHERE company_code=?',
 warehouses:'SELECT code,name FROM warehouses WHERE company_code=?',
 customers:'SELECT id,name,customer_code,customer_group,account_number,salesman_id FROM customers WHERE company_code=?',
 suppliers:'SELECT id,name,supplier_code,account_number FROM suppliers WHERE company_code=?',
 salesmen:'SELECT id,name,salesman_code FROM salesmen WHERE company_code=?',
 invoices:"SELECT id,invoice_number,invoice_date,due_date,customer_id,customer_name,salesman_id,salesman_name,currency,document_state,subtotal,tax,total,warehouse_code,posted_by,created_by,historical_fallbacks FROM invoices WHERE company_code=? AND document_state IN ('posted','reversed')",
 lines:"SELECT l.* FROM invoice_lines l JOIN invoices i ON i.id=l.invoice_id WHERE i.company_code=? AND i.document_state IN ('posted','reversed')",
 credits:"SELECT id,credit_number,credit_date,original_invoice_id,customer_id,currency,subtotal,tax,total,warehouse_code,posted_by,workflow FROM credit_notes WHERE company_code=? AND document_state='posted'",
 creditLines:"SELECT l.* FROM credit_note_lines l JOIN credit_notes n ON n.id=l.credit_note_id WHERE n.company_code=? AND n.document_state='posted'",
 purchases:'SELECT id,purchase_number,purchase_date,supplier_id,supplier_name,supplier_invoice_number,currency,warehouse_code,subtotal,tax,total,expenses_local,currency_rate FROM purchase_invoices WHERE company_code=?',
 purchaseLines:'SELECT l.* FROM purchase_invoice_lines l JOIN purchase_invoices p ON p.id=l.purchase_invoice_id WHERE p.company_code=?',
 stock:'SELECT * FROM stock_transactions WHERE company_code=? ORDER BY transaction_date,id',
 ledger:'SELECT * FROM accounting_transactions WHERE company_code=? ORDER BY transaction_date,id',
 receipts:'SELECT id,receipt_number,receipt_date,customer_id,amount,currency,payment_method,account_number FROM customer_receipts WHERE company_code=?',
 allocations:'SELECT a.invoice_id,a.amount,r.receipt_date AS date FROM receipt_invoice_allocations a JOIN customer_receipts r ON r.id=a.receipt_id AND r.company_code=a.company_code JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code WHERE a.company_code=?',
 advances:'SELECT a.invoice_id,a.amount,a.application_date AS date FROM customer_advance_applications a JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code JOIN customer_receipts r ON r.id=a.receipt_id AND r.company_code=a.company_code WHERE a.company_code=?',
 creditApplications:"SELECT a.invoice_id,a.amount,MAX(a.application_date,n.credit_date) AS date FROM credit_note_applications a JOIN credit_notes n ON n.id=a.credit_note_id AND n.company_code=a.company_code JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code WHERE a.company_code=? AND n.document_state='posted'",
 prices:'SELECT p.name,p.code,l.item_id,l.price FROM price_list_items l JOIN price_lists p ON p.id=l.price_list_id JOIN items i ON i.id=l.item_id AND i.company_code=p.company_code WHERE p.company_code=?',
};
export async function loadReportData(company:string){const db=getRawDb();const entries=Object.entries(reportQueries);const results=await db.batch(entries.map(([,sql])=>db.prepare(sql).bind(company)));return Object.fromEntries(entries.map(([key],i)=>[key,results[i].results as Record<string,any>[]]));}
