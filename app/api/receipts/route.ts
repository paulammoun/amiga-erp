import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings, type WorkshopSettings } from "../../../db/settings";
import { invoiceOutstandingSql, receiptAdvanceSql } from "../../../db/receivables";
import { ensureHistoricalInvoiceValues } from "../../../db/invoice-history";
import { allocateDocumentNumber } from "../../../db/document-numbers";
import { getCurrency } from "../../../db/currencies";
import { requestHash, requestKey } from "../../../lib/request-idempotency";
import {guardedReceiptAllocation} from "../../../db/allocation-guards";

type ReceiptValues = {
  customerId: number; receiptDate: string; amount: number; currency: string;
  paymentMethod: string; reference: string; notes: string;
};
type InvoiceBalance = { id: number; invoiceNumber: string; total: number; outstanding: number; currency:string; currencyRate:number };
type Allocation = { invoiceId: number; amount: number; amountReceiptCurrency?:number };
type Posting = {
  values: ReceiptValues; accountNumber: string; customerAccount: string;
  customerCurrency: string; allocations: Allocation[];
  localAmount: number; customerAmount: number; invoiceCurrencyAmount: number;
};
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const receiptSelect = `
  SELECT r.id, r.receipt_number AS receiptNumber, r.customer_id AS customerId,
    r.receipt_date AS receiptDate, r.amount, r.currency, r.invoice_currency_amount AS invoiceCurrencyAmount,
    ${receiptAdvanceSql("r.id","r.amount")} AS advanceBalance,r.account_number AS accountNumber,
    r.payment_method AS paymentMethod, r.reference, r.notes, r.created_at AS createdAt,
    c.name AS customerName, COALESCE(c.customer_code, printf('CUS-%05d', c.id)) AS customerCode,
    c.mof_number AS customerMofNumber, c.phone AS customerPhone,
    c.email AS customerEmail, c.address AS customerAddress,
    (SELECT COUNT(*) FROM (
      SELECT invoice_id FROM receipt_invoice_allocations WHERE receipt_id=r.id
      UNION SELECT invoice_id FROM customer_advance_applications WHERE receipt_id=r.id
    )) AS invoiceCount
  FROM customer_receipts r
  JOIN customers c ON c.id = r.customer_id AND c.company_code = r.company_code`;

function details(body: Record<string, unknown>): ReceiptValues {
  const customerId = Number(body.customerId);
  const receiptDate = String(body.receiptDate ?? "").trim();
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "").trim().toUpperCase();
  const paymentMethod = String(body.paymentMethod ?? "cash").trim();
  const reference = String(body.reference ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  if (!Number.isSafeInteger(customerId) || customerId < 1) throw new Error("Select a customer.");
  if (!validDate(receiptDate)) throw new Error("Enter a valid receipt date.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || Math.abs(amount-round(amount)) > 0.00001) throw new Error("Enter a positive amount with at most two decimal places.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a valid three-letter currency code.");
  if (!["cash", "card", "bank_transfer", "check", "other"].includes(paymentMethod)) throw new Error("Select a valid payment method.");
  if (reference.length > 200 || notes.length > 2000) throw new Error("Receipt details are too long.");
  return { customerId, receiptDate, amount, currency, paymentMethod, reference, notes };
}

function allocationsFrom(body: Record<string, unknown>): Allocation[] {
  if ("invoiceIds" in body) throw new Error("Refresh this page and enter the amount to apply to each invoice.");
  if (body.allocations === undefined) return [];
  if (!Array.isArray(body.allocations) || body.allocations.length > 100) throw new Error("Enter amounts for up to 100 invoices.");
  const allocations=body.allocations.map((value:unknown)=>{
    const row=value as Record<string,unknown>;
    return {invoiceId:Number(row?.invoiceId),amount:Number(row?.amount)};
  });
  if (allocations.some(row=>!Number.isSafeInteger(row.invoiceId)||row.invoiceId<1||!Number.isFinite(row.amount)||row.amount<=0||Math.abs(row.amount-round(row.amount))>0.00001)
    ||new Set(allocations.map(row=>row.invoiceId)).size!==allocations.length)
    throw new Error("Enter a positive amount with at most two decimals for each selected invoice.");
  return allocations;
}

async function preparePosting(db: D1Database, company: string, values: ReceiptValues, accountNumber: string, allocations: Allocation[]): Promise<Posting> {
  const settings: WorkshopSettings = await getWorkshopSettings(company, db);
  const receiptCurrency=await getCurrency(company,values.currency,db),rate=Number(receiptCurrency?.rate);
  if(!receiptCurrency?.active||!Number.isFinite(rate)||rate<=0)throw new Error("Select an active receipt currency with a valid rate.");
  const [customer, paymentAccount] = await Promise.all([
    db.prepare("SELECT a.account_number AS accountNumber FROM customers c JOIN accounts a ON a.id=c.account_id AND a.company_code=c.company_code WHERE c.id=? AND c.company_code=?").bind(values.customerId, company).first<{accountNumber:string}>(),
    db.prepare("SELECT account_number AS accountNumber,currency,active FROM accounts WHERE company_code=? AND account_number=?").bind(company, accountNumber).first<{accountNumber:string;currency:string;active:number}>(),
  ]);
  if (!customer) throw new Error("This customer needs a linked account in this company. Review existing data in the chart of accounts before posting.");
  if (!customer.accountNumber?.trim()) throw new Error("Set the customer's account number in Customer master data before posting this receipt.");
  if (!paymentAccount || !paymentAccount.active || !/^[0-9]{10}$/.test(paymentAccount.accountNumber)) throw new Error("Select an active payment account from the chart of accounts.");
  if (paymentAccount.currency !== values.currency) throw new Error(`The payment account uses ${paymentAccount.currency}; select an account in ${values.currency}.`);
  if (paymentAccount.accountNumber === customer.accountNumber) throw new Error("Payment and customer accounts must be different.");
  const customerAccount = await db.prepare("SELECT account_number AS accountNumber,currency,active FROM accounts WHERE company_code=? AND account_number=?")
    .bind(company, customer.accountNumber).first<{accountNumber:string;currency:string;active:number}>();
  if (!customerAccount || !customerAccount.active || !/^[0-9]{10}$/.test(customerAccount.accountNumber)) throw new Error("The customer's ledger account must exist and be active in the chart of accounts.");
  const accountCurrency=await getCurrency(company,customerAccount.currency,db);
  if(!accountCurrency?.active)throw new Error("The customer account currency must be active in Currency master data.");

  const localAmount = round(values.amount*rate);
  const defaultCurrency=await getCurrency(company,settings.defaultCurrency,db),defaultAmount=round(localAmount/Number(defaultCurrency?.rate||1));
  if (!Number.isFinite(localAmount) || !Number.isFinite(defaultAmount) || defaultAmount <= 0 || localAmount <= 0 || localAmount > 1e15)
    throw new Error("Receipt amount cannot be converted with the configured rate.");
  const customerAmount = round(localAmount/Number(accountCurrency.rate));
  let appliedReceiptCurrency=0;
  for (const allocation of allocations) {
    const invoice = await db.prepare(`SELECT i.id,i.invoice_number AS invoiceNumber,i.total,i.currency,CASE WHEN i.currency_rate>0 THEN i.currency_rate ELSE 1 END AS currencyRate,
      ${invoiceOutstandingSql("i.id","i.total")} AS outstanding
      FROM invoices i WHERE i.id=? AND i.customer_id=? AND i.company_code=?`)
      .bind(allocation.invoiceId, values.customerId, company).first<InvoiceBalance>();
    if (!invoice) throw new Error("A selected invoice does not belong to this customer.");
    if (invoice.outstanding <= 0) throw new Error(`${invoice.invoiceNumber} is already closed.`);
    if(allocation.amount>invoice.outstanding+0.00001)throw new Error(`The amount applied to ${invoice.invoiceNumber} exceeds its outstanding balance.`);
    allocation.amountReceiptCurrency=round(allocation.amount*Number(invoice.currencyRate)/rate);
    appliedReceiptCurrency=round(appliedReceiptCurrency+allocation.amountReceiptCurrency);
  }
  if(appliedReceiptCurrency>values.amount+0.00001)
    throw new Error("The amounts applied to invoices exceed the receipt amount.");
  return { values, accountNumber, customerAccount: customer.accountNumber, customerCurrency: customerAccount.currency,
    allocations, localAmount, customerAmount, invoiceCurrencyAmount:defaultAmount };
}

function postingStatements(db: D1Database, company: string, receiptNumber: string, posting: Posting) {
  const {values,accountNumber,customerAccount,customerCurrency,allocations,localAmount,customerAmount} = posting;
  const receiptId = "(SELECT id FROM customer_receipts WHERE receipt_number=? AND company_code=?)";
  const statements = [
    db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
      VALUES(?,'receipt',${receiptId},?,?,?,?,?,?,'debit',?)`)
      .bind(company,receiptNumber,company,values.receiptDate,accountNumber,values.currency,receiptNumber,values.amount,localAmount,"Customer payment received"),
    db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
      VALUES(?,'receipt',${receiptId},?,?,?,?,?,?,'credit',?)`)
      .bind(company,receiptNumber,company,values.receiptDate,customerAccount,customerCurrency,receiptNumber,customerAmount,localAmount,"Customer receivable settled"),
  ];
  for (const allocation of allocations) {
    statements.push(guardedReceiptAllocation(db,company,{receiptNumber,invoiceId:allocation.invoiceId,amount:allocation.amount,amountReceiptCurrency:Number(allocation.amountReceiptCurrency)}));
  }
  return statements;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const db = getRawDb(), company = auth.companyCode.toLowerCase();await ensureHistoricalInvoiceValues(company,db);
    const params = new URL(request.url).searchParams;
    const customerId = params.get("customerId");
    if (customerId !== null) {
      if (!Number.isSafeInteger(Number(customerId)) || Number(customerId) < 1) return Response.json({error:"Invalid customer."},{status:400});
      const result = await db.prepare(`SELECT i.id,i.invoice_number AS invoiceNumber,i.invoice_date AS invoiceDate,i.total,i.currency,i.currency_rate AS currencyRate,
        ${invoiceOutstandingSql("i.id","i.total")} AS outstanding
        FROM invoices i WHERE i.company_code=? AND i.customer_id=? AND ${invoiceOutstandingSql("i.id","i.total")}>0
        ORDER BY i.invoice_date,i.id`).bind(company,Number(customerId)).all();
      return Response.json({invoices:result.results});
    }
    const id = params.get("id");
    if (id) {
      if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) return Response.json({error:"Invalid receipt."},{status:400});
      const receipt = await db.prepare(`${receiptSelect} WHERE r.id=? AND r.company_code=?`).bind(Number(id),company).first();
      if (!receipt) return Response.json({error:"Receipt not found."},{status:404});
      const allocations = await db.prepare(`SELECT i.invoice_number AS invoiceNumber,a.amount,i.currency AS invoiceCurrency,i.invoice_date AS invoiceDate,
        r.receipt_date AS applicationDate,'receipt' AS applicationType
        FROM receipt_invoice_allocations a JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code
        JOIN customer_receipts r ON r.id=a.receipt_id
        WHERE a.receipt_id=? AND a.company_code=?
        UNION ALL
        SELECT i.invoice_number AS invoiceNumber,a.amount,i.currency AS invoiceCurrency,i.invoice_date AS invoiceDate,
        a.application_date AS applicationDate,'advance' AS applicationType
        FROM customer_advance_applications a JOIN invoices i ON i.id=a.invoice_id AND i.company_code=a.company_code
        WHERE a.receipt_id=? AND a.company_code=? ORDER BY applicationDate,invoiceNumber`).bind(Number(id),company,Number(id),company).all();
      return Response.json({receipt,allocations:allocations.results,settings:await getWorkshopSettings(company,db)});
    }
    const result = await db.prepare(`${receiptSelect} WHERE r.company_code=? ORDER BY r.receipt_date DESC,r.id DESC LIMIT 500`).bind(company).all();
    return Response.json({receipts:result.results});
  } catch (error) {
    console.error(error);
    return Response.json({error:"Could not load customer receipts."},{status:503});
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string,unknown>,key=requestKey(body.requestKey),hash=await requestHash({...body,requestKey:undefined});
    const values = details(body), allocations = allocationsFrom(body);
    const accountNumber = String(body.accountNumber??"").trim();
    if (!accountNumber || accountNumber.length > 100) throw new Error("Select a payment account from the chart of accounts.");
    const db = getRawDb(), company = auth.companyCode.toLowerCase();await ensureHistoricalInvoiceValues(company,db);
    const duplicate=await db.prepare("SELECT id,receipt_number AS receiptNumber,request_hash AS requestHash FROM customer_receipts WHERE company_code=? AND request_key=?").bind(company,key).first<{id:number;receiptNumber:string;requestHash:string}>();
    if(duplicate)return duplicate.requestHash===hash?Response.json({receipt:duplicate,duplicate:true}):Response.json({error:"This save key was already used for different receipt details."},{status:409});
    const posting = await preparePosting(db,company,values,accountNumber,allocations);
    const receiptNumber = await allocateDocumentNumber(company,"receipt",db);
    const statements = [
      db.prepare(`INSERT INTO customer_receipts(company_code,receipt_number,customer_id,receipt_date,amount,currency,currency_rate,invoice_currency_amount,account_number,payment_method,reference,notes,request_key,request_hash)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(company,receiptNumber,values.customerId,values.receiptDate,values.amount,values.currency,posting.localAmount/values.amount,posting.invoiceCurrencyAmount,accountNumber,values.paymentMethod,values.reference,values.notes,key,hash),
      ...postingStatements(db,company,receiptNumber,posting),
    ];
    const results = await db.batch(statements);
    if (results.some(result=>!result.success)) throw new Error("Could not post receipt.");
    const receipt = await db.prepare("SELECT id,receipt_number AS receiptNumber FROM customer_receipts WHERE receipt_number=? AND company_code=?").bind(receiptNumber,company).first();
    return Response.json({receipt},{status:201});
  } catch (error) {
    console.error(error);
    const message=error instanceof Error?error.message:"Could not create receipt.";
    const allocationConflict=/allocation_exceeds|NOT NULL constraint failed: (receipt_invoice_allocations|customer_advance_applications)\.amount/i.test(message);
    return Response.json({error:allocationConflict?"Another payment changed an invoice balance. Refresh and try again.":message},{status:/already|save key/i.test(message)||allocationConflict?409:400});
  }
}

// Older receipts had no payment account and therefore no accounting entries. Post them once, preserving the original payment.
export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string,unknown>;
    const id = Number(body.id), allocations = allocationsFrom(body), accountNumber = String(body.accountNumber??"").trim();
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid receipt.");
    if (!accountNumber || accountNumber.length > 100) throw new Error("Select a payment account from the chart of accounts.");
    const db = getRawDb(), company = auth.companyCode.toLowerCase();
    const receipt = await db.prepare(`SELECT receipt_number AS receiptNumber,customer_id AS customerId,receipt_date AS receiptDate,
      amount,currency,account_number AS accountNumber,payment_method AS paymentMethod,reference,notes
      FROM customer_receipts WHERE id=? AND company_code=?`).bind(id,company)
      .first<ReceiptValues & {receiptNumber:string;accountNumber:string}>();
    if (!receipt) return Response.json({error:"Receipt not found."},{status:404});
    if (receipt.accountNumber) return Response.json({error:"This receipt is already posted."},{status:409});
    const posting = await preparePosting(db,company,details(receipt as unknown as Record<string,unknown>),accountNumber,allocations);
    const results = await db.batch([
      db.prepare("UPDATE customer_receipts SET account_number=?,currency_rate=?,invoice_currency_amount=? WHERE id=? AND company_code=? AND account_number=''")
        .bind(accountNumber,posting.localAmount/posting.values.amount,posting.invoiceCurrencyAmount,id,company),
      ...postingStatements(db,company,receipt.receiptNumber,posting),
    ]);
    if (results.some(result=>!result.success)) throw new Error("Could not post receipt.");
    return Response.json({receipt:{id,receiptNumber:receipt.receiptNumber}});
  } catch (error) {
    console.error(error);
    return Response.json({error:error instanceof Error?error.message:"Could not post receipt."},{status:400});
  }
}
