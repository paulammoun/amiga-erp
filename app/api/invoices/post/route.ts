import {warehouseFor,warehouseBalanceSql} from '../../../../db/warehouses';
import {ensureStockLedger} from '../../../../db/stock';
import {getRawDb} from "../../../../db";
import {requireUser} from "../../../../db/auth";
import {getWorkshopSettings} from "../../../../db/settings";
import {allocateDocumentNumber} from "../../../../db/document-numbers";
import {documentStock} from "../../../../db/stock";
import {documentAccounting} from "../../../../db/accounting";
import {localCountervalues} from "../../../../lib/invoice-totals";
import {requestHash,requestKey} from "../../../../lib/request-idempotency";
import {getCurrency} from "../../../../db/currencies";
import {invoiceOutstandingSql} from "../../../../db/receivables";

const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export async function POST(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const body=await request.json() as Record<string,unknown>,id=Number(body.id),revision=Number(body.revision),key=requestKey(body.requestKey),hash=await requestHash({...body,requestKey:undefined});
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(revision)||revision<1)throw new Error("Refresh the draft before posting.");
  const db=getRawDb(),company=auth.companyCode.toLowerCase(),settings=await getWorkshopSettings(company,db);
  const invoice=await db.prepare(`SELECT i.warehouse_code AS warehouseCode,i.id,i.invoice_number AS invoiceNumber,i.document_state AS documentState,i.revision,i.customer_id AS customerId,i.invoice_date AS invoiceDate,i.currency,i.currency_rate AS currencyRate,i.subtotal,i.tax,i.total,i.post_request_key AS postRequestKey,i.post_request_hash AS postRequestHash,c.status,c.credit_hold AS creditHold,c.block_invoices AS blockInvoices,c.allow_credit_sales AS allowCreditSales,c.require_po_number AS requirePoNumber,c.warn_credit_limit AS warnCreditLimit,c.credit_limit AS creditLimit,c.default_currency AS customerCurrency,COALESCE((SELECT a.account_number FROM accounts a WHERE a.id=c.account_id AND a.company_code=c.company_code),'') AS customerAccount FROM invoices i JOIN customers c ON c.id=i.customer_id AND c.company_code=i.company_code WHERE i.id=? AND i.company_code=?`).bind(id,company).first<Record<string,unknown>>();
  if(!invoice)return Response.json({error:"Draft not found."},{status:404});
  if(invoice.documentState!=="draft")return invoice.postRequestKey===key&&invoice.postRequestHash===hash?Response.json({invoice,duplicate:true}):Response.json({error:"This invoice has already been posted."},{status:409});
  if(Number(invoice.revision)!==revision)return Response.json({error:"This draft changed after you opened it. Refresh before posting."},{status:409});
  if(invoice.status!=="active"||invoice.creditHold||invoice.blockInvoices)return Response.json({error:"This customer is on hold or blocked for posting."},{status:409});
  const saved=await db.prepare("SELECT purchase_order_number AS po FROM invoices WHERE id=?").bind(id).first<{po:string}>();if(invoice.requirePoNumber&&!saved?.po)return Response.json({error:"Enter the customer's purchase order number before posting."},{status:409});
  const receivePayment=body.receivePayment&&typeof body.receivePayment==="object"?body.receivePayment as Record<string,unknown>:null;
  if(!invoice.allowCreditSales&&Number(invoice.total)>0&&!receivePayment)return Response.json({error:"Credit sales are disabled for this customer. Use Post and Receive Payment."},{status:409});
  if(!receivePayment&&invoice.warnCreditLimit&&Number(invoice.creditLimit)>0){
   const customerCurrency=await getCurrency(company,String(invoice.customerCurrency),db),customerRate=Number(customerCurrency?.rate||1),exposure=await db.prepare(`SELECT COALESCE(SUM(${invoiceOutstandingSql("i.id","i.total")}*CASE WHEN i.currency_rate>0 THEN i.currency_rate ELSE 1 END/?),0) AS amount FROM invoices i WHERE i.company_code=? AND i.customer_id=? AND i.id<>?`).bind(customerRate,company,invoice.customerId,id).first<{amount:number}>(),projected=round(Number(exposure?.amount||0)+Number(invoice.total)*Number(invoice.currencyRate)/customerRate);
   if(projected>Number(invoice.creditLimit)+0.00001&&!body.creditLimitConfirmed)return Response.json({error:`Credit limit warning: the projected balance is ${projected.toFixed(2)} ${invoice.customerCurrency}, above the ${Number(invoice.creditLimit).toFixed(2)} limit.`,requiresConfirmation:true,confirmationType:"credit"},{status:409});
  }
  await ensureStockLedger(company,db);
  const warehouseCode=await warehouseFor(db,company,invoice.warehouseCode);
  const shortages=await db.prepare(`SELECT it.name,${warehouseBalanceSql('it.id','it.company_code','?')} AS available,q.qty AS requested FROM (SELECT item_id,SUM(quantity*unit_factor) qty FROM invoice_lines WHERE invoice_id=? AND line_type='part' GROUP BY item_id) q JOIN items it ON it.id=q.item_id AND it.company_code=? WHERE ${warehouseBalanceSql('it.id','it.company_code','?')}<q.qty-0.000000001`).bind(warehouseCode,id,company,warehouseCode).all<{name:string;available:number;requested:number}>();
  if(shortages.results.length&&settings.negativeStockPolicy==="block")return Response.json({error:"Insufficient stock: "+shortages.results.map(s=>`${s.name} (${s.available} available, ${s.requested} requested)`).join(", ")},{status:409});
  if(shortages.results.length&&!body.stockWarningAcknowledged)return Response.json({error:"Posting will make stock negative for: "+shortages.results.map(s=>s.name).join(", "),requiresConfirmation:true,confirmationType:"stock"},{status:409});
  const invoiceNumber=await allocateDocumentNumber(company,"invoice",db),token=crypto.randomUUID(),countervalues=localCountervalues({subtotal:Number(invoice.subtotal),tax:Number(invoice.tax),total:Number(invoice.total)},Number(invoice.currencyRate));
  const statements:D1PreparedStatement[]=[
   db.prepare(`INSERT INTO invoice_posting_guards(invoice_id,token) SELECT id,CASE WHEN EXISTS(SELECT 1 FROM invoice_lines l JOIN items it ON it.id=l.item_id WHERE l.invoice_id=invoices.id AND it.active=0) THEN NULL WHEN ?='block' AND EXISTS(SELECT 1 FROM (SELECT item_id,SUM(quantity*unit_factor) qty FROM invoice_lines WHERE invoice_id=invoices.id AND line_type='part' GROUP BY item_id) q JOIN items it ON it.id=q.item_id WHERE ${warehouseBalanceSql('it.id','invoices.company_code','invoices.warehouse_code')}<q.qty-0.000000001) THEN NULL ELSE ? END FROM invoices WHERE id=? AND company_code=? AND document_state='draft' AND revision=?`).bind(settings.negativeStockPolicy,token,id,company,revision),
   db.prepare("UPDATE invoices SET invoice_number=?,document_state='posted',posted_by=?,posted_at=CURRENT_TIMESTAMP,post_request_key=?,post_request_hash=?,revision=revision+1,edit_token=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_code=? AND document_state='draft' AND EXISTS(SELECT 1 FROM invoice_posting_guards g WHERE g.invoice_id=invoices.id AND g.token=?)").bind(invoiceNumber,(auth.username||"System"),key,hash,token,id,company,token),
   ...documentStock(db,"sale",invoiceNumber,company,{invoiceId:id,editToken:token}),
   ...documentAccounting(db,"sale",invoiceNumber,company,countervalues,{invoiceId:id,editToken:token}),
  ];
  if(receivePayment&&Number(invoice.total)>0){
   const accountNumber=String(receivePayment.accountNumber??"").trim(),method=String(receivePayment.paymentMethod??"cash"),reference=String(receivePayment.reference??"").trim();if(!accountNumber)throw new Error("Select a payment account.");if(!["cash","card","bank_transfer","check","other"].includes(method))throw new Error("Select a valid payment method.");
   const paymentAccount=await db.prepare("SELECT currency,active FROM accounts WHERE company_code=? AND account_number=?").bind(company,accountNumber).first<{currency:string;active:number}>();if(!paymentAccount?.active||paymentAccount.currency!==invoice.currency)throw new Error(`Select an active ${invoice.currency} payment account.`);
   const customerAccount=await db.prepare("SELECT currency,active FROM accounts WHERE company_code=? AND account_number=?").bind(company,invoice.customerAccount).first<{currency:string;active:number}>();if(!customerAccount?.active)throw new Error("Set an active receivable account for this customer.");
   const customerCurrency=await getCurrency(company,customerAccount.currency,db),receiptNumber=await allocateDocumentNumber(company,"receipt",db),amount=Number(invoice.total),customerAmount=round(countervalues.total/Number(customerCurrency?.rate||1));
   statements.push(db.prepare("INSERT INTO customer_receipts(company_code,receipt_number,customer_id,receipt_date,amount,currency,currency_rate,invoice_currency_amount,account_number,payment_method,reference,notes,request_key,request_hash) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM invoices WHERE id=? AND edit_token=?)").bind(company,receiptNumber,invoice.customerId,invoice.invoiceDate,amount,invoice.currency,invoice.currencyRate,amount,accountNumber,method,reference,"Payment received with "+invoiceNumber,key+":payment",hash,id,token),db.prepare("INSERT INTO receipt_invoice_allocations(company_code,receipt_id,invoice_id,amount,amount_receipt_currency) SELECT ?,r.id,?,?,? FROM customer_receipts r WHERE r.company_code=? AND r.receipt_number=?").bind(company,id,amount,amount,company,receiptNumber),db.prepare("INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes) SELECT ?,'receipt',r.id,?,?,?,?,?,?,'debit','Customer payment received' FROM customer_receipts r WHERE r.company_code=? AND r.receipt_number=?").bind(company,invoice.invoiceDate,accountNumber,invoice.currency,receiptNumber,amount,countervalues.total,company,receiptNumber),db.prepare("INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes) SELECT ?,'receipt',r.id,?,?,?,?,?,?,'credit','Customer receivable settled' FROM customer_receipts r WHERE r.company_code=? AND r.receipt_number=?").bind(company,invoice.invoiceDate,invoice.customerAccount,customerAccount.currency,receiptNumber,customerAmount,countervalues.total,company,receiptNumber));
  }
  statements.push(db.prepare("DELETE FROM invoice_posting_guards WHERE invoice_id=? AND token=?").bind(id,token));
  const results=await db.batch(statements);if(results.some(r=>!r.success))throw new Error("Could not post the invoice.");
  const posted=await db.prepare("SELECT id,invoice_number AS invoiceNumber,document_state AS documentState,revision,post_request_key AS postRequestKey FROM invoices WHERE id=? AND company_code=?").bind(id,company).first<Record<string,unknown>>();if(posted?.postRequestKey!==key)return Response.json({error:"Another request posted this invoice first."},{status:409});return Response.json({invoice:posted});
 }catch(error){console.error(error);const message=error instanceof Error?error.message:"Could not post invoice.";return Response.json({error:/NOT NULL constraint failed: invoice_posting_guards\.token/.test(message)?"Stock or item status changed while posting. Refresh and try again.":message},{status:400})}
}
