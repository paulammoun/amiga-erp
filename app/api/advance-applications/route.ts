import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings } from "../../../db/settings";
import { invoiceOutstandingSql, receiptAdvanceSql } from "../../../db/receivables";
import {ensureHistoricalInvoiceValues} from "../../../db/invoice-history";
import {requestHash,requestKey} from "../../../lib/request-idempotency";
import {guardedAdvanceApplication} from "../../../db/allocation-guards";

const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
function validDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00Z");
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export async function GET(request:Request){
  const auth=await requireUser(request);
  if(auth instanceof Response)return auth;
  try{
    const db=getRawDb(),company=auth.companyCode.toLowerCase(),settings=await getWorkshopSettings(company,db);await ensureHistoricalInvoiceValues(company,db);
    const [advances,applications]=await Promise.all([
      db.prepare(`SELECT r.id AS receiptId,r.receipt_number AS receiptNumber,r.receipt_date AS receiptDate,
        r.customer_id AS customerId,c.name AS customerName,r.amount AS receiptAmount,
        r.currency AS receiptCurrency,r.currency_rate AS receiptCurrencyRate,${receiptAdvanceSql("r.id","r.amount")} AS available
        FROM customer_receipts r JOIN customers c ON c.id=r.customer_id AND c.company_code=r.company_code
        WHERE r.company_code=? AND r.account_number<>'' AND ${receiptAdvanceSql("r.id","r.amount")}>0
        ORDER BY r.receipt_date,r.id`).bind(company).all(),
      db.prepare(`SELECT a.id,a.application_date AS applicationDate,a.amount,
        r.receipt_number AS receiptNumber,c.name AS customerName,i.invoice_number AS invoiceNumber,i.currency AS invoiceCurrency
        FROM customer_advance_applications a
        JOIN customer_receipts r ON r.id=a.receipt_id AND r.company_code=a.company_code
        JOIN customers c ON c.id=r.customer_id AND c.company_code=r.company_code
        JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code
        WHERE a.company_code=? ORDER BY a.application_date DESC,a.id DESC LIMIT 500`).bind(company).all()
    ]);
    return Response.json({advances:advances.results,applications:applications.results,currency:settings.defaultCurrency});
  }catch(error){console.error(error);return Response.json({error:"Could not load customer advances."},{status:503})}
}

export async function POST(request:Request){
  const auth=await requireUser(request);
  if(auth instanceof Response)return auth;
  try{
    const body=await request.json() as Record<string,unknown>,key=requestKey(body.requestKey),hash=await requestHash({...body,requestKey:undefined});
    const receiptId=Number(body.receiptId),invoiceId=Number(body.invoiceId),amount=Number(body.amount);
    const applicationDate=String(body.applicationDate??"").trim();
    if(!Number.isSafeInteger(receiptId)||receiptId<1||!Number.isSafeInteger(invoiceId)||invoiceId<1)
      throw new Error("Select a customer advance and invoice.");
    if(!Number.isFinite(amount)||amount<=0||amount>1e12||Math.abs(amount-round(amount))>0.00001)
      throw new Error("Enter a positive amount with at most two decimal places.");
    if(!validDate(applicationDate))throw new Error("Enter a valid application date.");
    const db=getRawDb(),company=auth.companyCode.toLowerCase();await ensureHistoricalInvoiceValues(company,db);
    const duplicate=await db.prepare("SELECT id,request_hash AS requestHash FROM customer_advance_applications WHERE company_code=? AND request_key=?").bind(company,key).first<{id:number;requestHash:string}>();
    if(duplicate)return duplicate.requestHash===hash?Response.json({application:duplicate,duplicate:true}):Response.json({error:"This save key was already used for a different advance application."},{status:409});
    const receipt=await db.prepare(`SELECT r.id,r.receipt_number AS receiptNumber,r.customer_id AS customerId,
      r.currency,r.currency_rate AS currencyRate,${receiptAdvanceSql("r.id","r.amount")} AS available
      FROM customer_receipts r WHERE r.id=? AND r.company_code=? AND r.account_number<>''`)
      .bind(receiptId,company).first<{id:number;receiptNumber:string;customerId:number;currency:string;currencyRate:number;available:number}>();
    if(!receipt)return Response.json({error:"Advance receipt not found."},{status:404});
    const invoice=await db.prepare(`SELECT i.invoice_number AS invoiceNumber,i.currency,i.currency_rate AS currencyRate,
      ${invoiceOutstandingSql("i.id","i.total")} AS outstanding
      FROM invoices i WHERE i.id=? AND i.company_code=? AND i.customer_id=?`)
      .bind(invoiceId,company,receipt.customerId).first<{invoiceNumber:string;currency:string;currencyRate:number;outstanding:number}>();
    if(!invoice)return Response.json({error:"Invoice not found for this customer."},{status:404});
    if(invoice.outstanding<=0)throw new Error("This invoice is already closed.");
    if(amount>invoice.outstanding+0.00001)throw new Error("The application exceeds the invoice's outstanding balance.");
    const amountReceiptCurrency=round(amount*Number(invoice.currencyRate||1)/Number(receipt.currencyRate||1));
    if(amountReceiptCurrency>receipt.available+0.00001)throw new Error("The application exceeds the customer's available advance.");
    const results=await db.batch([guardedAdvanceApplication(db,company,{receiptId,invoiceId,applicationDate,amount,amountReceiptCurrency,requestKey:key,requestHash:hash})]);
    if(results.some(result=>!result.success))throw new Error("Could not apply the advance.");
    return Response.json({application:{receiptNumber:receipt.receiptNumber,invoiceNumber:invoice.invoiceNumber,amount,currency:invoice.currency}},{status:201});
  }catch(error){
    console.error(error);
    const message=error instanceof Error?error.message:"Could not apply the advance.";
    const allocationConflict=/allocation_exceeds|NOT NULL constraint failed: (receipt_invoice_allocations|customer_advance_applications)\.amount/i.test(message);
    return Response.json({error:allocationConflict?"Another payment changed the available balance. Refresh and try again.":message},{status:/save key|already/i.test(message)||allocationConflict?409:400});
  }
}
