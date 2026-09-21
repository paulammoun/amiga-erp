import {newPartyAccount,accountAssertion} from "../../../db/coa-write";
import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings } from "../../../db/settings";
import { invoiceAppliedSql, invoiceOutstandingSql,invoicePaymentStatusSql } from "../../../db/receivables";
import {ensureHistoricalInvoiceValues} from "../../../db/invoice-history";
import { ensureDefaultPriceList } from "../../../db/price-lists";
import { ensureCustomerMasterValues } from "../../../db/customer-master-values";
import {getCurrency} from "../../../db/currencies";

const customerColumns = `id,
  COALESCE(customer_code, printf('CUS-%05d', id)) AS code,
  account_number AS accountNumber, account_id AS accountId,
  salesman_id AS salesmanId,
  price_list_id AS priceListId,
  name,status,trading_name AS tradingName,customer_type AS customerType,
  mof_number AS mofNumber,company_registration_number AS companyRegistrationNumber,
  preferred_language AS preferredLanguage,phone,mobile,email,website,address,city,country,
  default_currency AS defaultCurrency,payment_terms AS paymentTerms,credit_limit AS creditLimit,
  default_discount AS defaultDiscount,customer_group AS customerGroup,territory,
  default_payment_method AS defaultPaymentMethod,vat_treatment AS vatTreatment,
  tax_registration_status AS taxRegistrationStatus,statement_delivery AS statementDelivery,
  statement_email AS statementEmail,allow_credit_sales AS allowCreditSales,
  apply_withholding_tax AS applyWithholdingTax,credit_hold AS creditHold,
  block_invoices AS blockInvoices,warn_credit_limit AS warnCreditLimit,
  require_po_number AS requirePoNumber,tags,acquisition_source AS acquisitionSource,
  internal_notes AS internalNotes,created_at AS createdAt`;

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const has=(body:Record<string,unknown>,key:string)=>Object.prototype.hasOwnProperty.call(body,key);
const text=(body:Record<string,unknown>,key:string,max=2000)=>{
  const value=String(body[key]??"").trim();
  if(value.length>max)throw new Error(`${key} is too long`);
  return value;
};
const choice=(body:Record<string,unknown>,key:string,allowed:string[],fallback:string)=>{
  const value=text(body,key,50)||fallback;
  if(!allowed.includes(value))throw new Error(`Select a valid ${key}`);
  return value;
};
const flag=(body:Record<string,unknown>,key:string,fallback:boolean)=>has(body,key)?body[key]===true:fallback;

function relatedRows(body:Record<string,unknown>){
  const contacts=has(body,"contacts")?(Array.isArray(body.contacts)?body.contacts:[]):null;
  const addresses=has(body,"addresses")?(Array.isArray(body.addresses)?body.addresses:[]):null;
  if(contacts&&contacts.length>50)throw new Error("Add up to 50 customer contacts");
  if(addresses&&addresses.length>25)throw new Error("Add up to 25 customer addresses");

  return {
    contacts:contacts?.map((raw,index)=>{
      const row=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;
      const value={name:text(row,"name",200),role:text(row,"role",100),phone:text(row,"phone",100),email:text(row,"email",320),receives:text(row,"receives",300)};
      if(!Object.values(value).some(Boolean))return null;
      if(!value.name)throw new Error(`Contact ${index+1} needs a name`);
      if(value.email&&!emailPattern.test(value.email))throw new Error(`Contact ${index+1} has an invalid email address`);
      return value;
    }).filter((row):row is NonNullable<typeof row>=>!!row)??null,
    addresses:addresses?.map((raw,index)=>{
      const row=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;
      const value={addressType:choice(row,"addressType",["billing","service","delivery","other"],"service"),label:text(row,"label",100),line1:text(row,"line1",500),line2:text(row,"line2",500),city:text(row,"city",100),region:text(row,"region",100),postalCode:text(row,"postalCode",40),country:text(row,"country",100)||"Lebanon"};
      if(![value.label,value.line1,value.line2,value.city,value.region,value.postalCode].some(Boolean))return null;
      if(!value.line1)throw new Error(`Address ${index+1} needs address line 1`);
      return value;
    }).filter((row):row is NonNullable<typeof row>=>!!row)??null,
  };
}

function details(body: Record<string, unknown>) {
  const name=text(body,"name",200),accountNumber=text(body,"accountNumber",100),mofNumber=text(body,"mofNumber",100),phone=text(body,"phone",100),mobile=text(body,"mobile",100),email=text(body,"email",320),website=text(body,"website",500),address=text(body,"address",500),city=text(body,"city",100),country=text(body,"country",100)||"Lebanon";
  const code=text(body,"code",40).toUpperCase(),salesmanId=Number(body.salesmanId),priceListId=Number(body.priceListId);
  const creditLimit=Number(body.creditLimit)||0,defaultDiscount=Number(body.defaultDiscount)||0;
  if(!name)throw new Error("Customer name is required");
  if(code&&!/^[A-Z0-9][A-Z0-9._-]*$/.test(code))throw new Error("Customer code can use letters, numbers, dots, dashes and underscores");
  if(email&&!emailPattern.test(email))throw new Error("Enter a valid email address");
  const statementEmail=text(body,"statementEmail",320);
  if(statementEmail&&!emailPattern.test(statementEmail))throw new Error("Enter a valid statement email address");
  if(website&&!/^https?:\/\//i.test(website))throw new Error("Website must start with http:// or https://");
  if(salesmanId&&(!Number.isSafeInteger(salesmanId)||salesmanId<1))throw new Error("Select a salesman");
  if(priceListId&&(!Number.isSafeInteger(priceListId)||priceListId<1))throw new Error("Select a price list");
  if(!Number.isFinite(creditLimit)||creditLimit<0||creditLimit>1e12)throw new Error("Enter a valid credit limit");
  if(!Number.isFinite(defaultDiscount)||defaultDiscount<0||defaultDiscount>100)throw new Error("Default discount must be between 0 and 100");
  return {
    code,accountNumber,salesmanId,priceListId,name,
    status:choice(body,"status",["active","on_hold","inactive"],"active"),
    tradingName:text(body,"tradingName",200),customerType:text(body,"customerType",50)||"individual",
    mofNumber,companyRegistrationNumber:text(body,"companyRegistrationNumber",100),preferredLanguage:text(body,"preferredLanguage",50)||"English",
    phone,mobile,email,website,address,city,country,
    defaultCurrency:text(body,"defaultCurrency",10).toUpperCase(),paymentTerms:text(body,"paymentTerms",50)||"cash",creditLimit,defaultDiscount,
    customerGroup:text(body,"customerGroup",50)||"retail",territory:text(body,"territory",50),
    defaultPaymentMethod:text(body,"defaultPaymentMethod",50)||"cash",vatTreatment:choice(body,"vatTreatment",["standard","zero_rated","exempt","non_resident"],"standard"),taxRegistrationStatus:text(body,"taxRegistrationStatus",50)||"not_registered",statementDelivery:text(body,"statementDelivery",50)||"on_request",statementEmail,
    allowCreditSales:flag(body,"allowCreditSales",true),applyWithholdingTax:flag(body,"applyWithholdingTax",false),creditHold:flag(body,"creditHold",false),blockInvoices:flag(body,"blockInvoices",false),warnCreditLimit:flag(body,"warnCreditLimit",true),requirePoNumber:flag(body,"requirePoNumber",false),
    tags:text(body,"tags",500),acquisitionSource:text(body,"acquisitionSource",50),internalNotes:text(body,"internalNotes",4000),
    ...relatedRows(body),
  };
}

export async function GET(request:Request) {
  const auth=await requireUser(request);
  if(auth instanceof Response)return auth;
  try {
    const db=getRawDb(),company=auth.companyCode.toLowerCase(),id=new URL(request.url).searchParams.get("id");
    if(id){
      if(!Number.isSafeInteger(Number(id))||Number(id)<1)return Response.json({error:"Invalid customer"},{status:400});
      const customer=await db.prepare(`SELECT ${customerColumns} FROM customers WHERE id=? AND company_code=?`).bind(Number(id),company).first();
      if(!customer)return Response.json({error:"Customer not found"},{status:404});
      await ensureHistoricalInvoiceValues(company,db);
      const [history,contacts,addresses]=await Promise.all([
        db.prepare(`SELECT i.id,i.invoice_number AS invoiceNumber,i.invoice_date AS invoiceDate,i.customer_id AS customerId,i.currency,i.currency_rate AS currencyRate,i.local_currency AS localCurrency,${invoicePaymentStatusSql("i.id","i.total")} AS status,i.total,i.created_at AS createdAt,
          ${invoiceAppliedSql("i.id")} AS appliedAmount,${invoiceOutstandingSql("i.id","i.total")} AS outstanding
          FROM invoices i WHERE i.customer_id=? AND i.company_code=? AND i.document_state NOT IN ('draft','cancelled') ORDER BY i.id DESC`).bind(Number(id),company).all(),
        db.prepare("SELECT id,name,role,phone,email,receives FROM customer_contacts WHERE customer_id=? AND company_code=? ORDER BY id").bind(Number(id),company).all(),
        db.prepare("SELECT id,address_type AS addressType,label,line1,line2,city,region,postal_code AS postalCode,country FROM customer_addresses WHERE customer_id=? AND company_code=? ORDER BY id").bind(Number(id),company).all(),
      ]);
      return Response.json({customer:{...customer,contacts:contacts.results,addresses:addresses.results},invoices:history.results});
    }
    const rows=await db.prepare(`SELECT ${customerColumns} FROM customers WHERE company_code=? ORDER BY name COLLATE NOCASE`).bind(company).all();
    return Response.json({customers:rows.results});
  }catch(error){console.error(error);return Response.json({error:"Could not load customers. Please try again."},{status:503});}
}

async function write(request:Request,update:boolean){
  const auth=await requireUser(request);
  if(auth instanceof Response)return auth;
  let body:Record<string,unknown>,values:ReturnType<typeof details>;
  try{body=await request.json();values=details(body);}catch(error){return Response.json({error:error instanceof Error?error.message:"Invalid customer details"},{status:400});}
  if(update&&(!Number.isSafeInteger(Number(body.id))||Number(body.id)<1))return Response.json({error:"Invalid customer"},{status:400});
  try{
    const db=getRawDb(),companyCode=auth.companyCode.toLowerCase(),id=update?Number(body.id):0;
    const settings=await getWorkshopSettings(companyCode,db);
    await ensureCustomerMasterValues(companyCode,db);
    const masterRows=await db.prepare("SELECT category,value_code AS code FROM customer_master_values WHERE company_code=?").bind(companyCode).all<{category:string;code:string}>();
    const masterCodes=new Set(masterRows.results.map(row=>`${row.category}\u0000${row.code}`));
    const defaultPriceListId=await ensureDefaultPriceList(companyCode,db),priceListId=values.priceListId||defaultPriceListId,defaultCurrency=values.defaultCurrency||settings.defaultCurrency;
    const configuredValues:[string,string,boolean][]=[
      ["customer_type",values.customerType,false],["preferred_language",values.preferredLanguage,false],["country",values.country,false],
      ["payment_terms",values.paymentTerms,false],["customer_group",values.customerGroup,false],["territory",values.territory,true],["payment_method",values.defaultPaymentMethod,false],
      ["tax_registration_status",values.taxRegistrationStatus,false],["statement_delivery",values.statementDelivery,false],["acquisition_source",values.acquisitionSource,true],
    ];
    const invalidMaster=configuredValues.find(([category,code,optional])=>code? !masterCodes.has(`${category}\u0000${code}`):!optional);
    if(invalidMaster)return Response.json({error:`Select a valid ${invalidMaster[0].replaceAll("_"," ")}`},{status:400});
    const currencyRecord=await getCurrency(companyCode,defaultCurrency,db);
    if(!currencyRecord)return Response.json({error:"Select a currency from Company Configuration."},{status:400});
    const invalidAddressCountry=values.addresses?.find(address=>!masterCodes.has(`country\u0000${address.country}`));
    if(invalidAddressCountry)return Response.json({error:"Select a valid country for each additional address"},{status:400});
    const salesman=values.salesmanId?await db.prepare("SELECT id FROM salesmen WHERE id=? AND company_code=?").bind(values.salesmanId,companyCode).first<{id:number}>():await db.prepare("SELECT id FROM salesmen WHERE company_code=? AND salesman_code='UNASSIGNED' AND active=1").bind(companyCode).first<{id:number}>();
    if(!salesman)return Response.json({error:"Select a salesman"},{status:400});
    if(!await db.prepare("SELECT id FROM price_lists WHERE id=? AND company_code=?").bind(priceListId,companyCode).first())return Response.json({error:"Select a valid price list"},{status:400});
    if(update&&!await db.prepare("SELECT id FROM customers WHERE id=? AND company_code=?").bind(id,companyCode).first())return Response.json({error:"Customer not found"},{status:404});
    if(values.code){
      const duplicate=await db.prepare("SELECT id FROM customers WHERE company_code=? AND UPPER(COALESCE(customer_code, printf('CUS-%05d', id)))=? AND id!=?").bind(companyCode,values.code,id).first();
      if(duplicate)return Response.json({error:"Customer code is already in use"},{status:409});
    }
    const existing=update?await db.prepare("SELECT customer_code AS code,account_number AS accountNumber,account_id AS accountId FROM customers WHERE id=? AND company_code=?").bind(id,companyCode).first<{code:string;accountNumber:string;accountId:number|null}>():null;
    if(!update&&!/^[0-9]{6}$/.test(values.code))return Response.json({error:"Customer code must contain exactly 6 digits, including leading zeros."},{status:400});
    if(existing&&!existing.code&&values.code===`CUS-${String(id).padStart(5,'0')}`)values.code='';
    if(existing&&values.code!==(existing.code??'')&&!/^[0-9]{6}$/.test(values.code))return Response.json({error:"A changed customer code must contain exactly 6 digits."},{status:400});
    if(existing&&(existing.accountId||existing.accountNumber)&&values.code!==existing.code)return Response.json({error:"This customer already has an account. Its code cannot change because the linked account number must be preserved."},{status:400});
    if(existing)values.accountNumber=existing.accountNumber;
    else values.accountNumber="";
    const generated=!update?await newPartyAccount(db,companyCode,'customer',values.code,values.name):null;
    if(generated)values.accountNumber=generated.number;
    const statements:D1PreparedStatement[]=generated?[...generated.before]:[];
    const unchanged=update?accountAssertion(db,"EXISTS(SELECT 1 FROM customers WHERE id=? AND company_code=? AND customer_code IS ? AND account_number=? AND account_id IS ?)",[id,companyCode,existing?.code??null,existing?.accountNumber??'',existing?.accountId??null]):null;
    if(unchanged)statements.push(unchanged.check);
    const bindValues=[values.code||null,values.accountNumber,salesman.id,priceListId,values.name,values.status,values.tradingName,values.customerType,values.mofNumber,values.companyRegistrationNumber,values.preferredLanguage,values.phone,values.mobile,values.email,values.website,values.address,values.city,values.country,defaultCurrency,values.paymentTerms,values.creditLimit,values.defaultDiscount,values.customerGroup,values.territory,values.defaultPaymentMethod,values.vatTreatment,values.taxRegistrationStatus,values.statementDelivery,values.statementEmail,values.allowCreditSales?1:0,values.applyWithholdingTax?1:0,values.creditHold?1:0,values.blockInvoices?1:0,values.warnCreditLimit?1:0,values.requirePoNumber?1:0,values.tags,values.acquisitionSource,values.internalNotes];
    statements.push(update
      ?db.prepare(`UPDATE customers SET customer_code=?,account_number=?,salesman_id=?,price_list_id=?,name=?,status=?,trading_name=?,customer_type=?,mof_number=?,company_registration_number=?,preferred_language=?,phone=?,mobile=?,email=?,website=?,address=?,city=?,country=?,default_currency=?,payment_terms=?,credit_limit=?,default_discount=?,customer_group=?,territory=?,default_payment_method=?,vat_treatment=?,tax_registration_status=?,statement_delivery=?,statement_email=?,allow_credit_sales=?,apply_withholding_tax=?,credit_hold=?,block_invoices=?,warn_credit_limit=?,require_po_number=?,tags=?,acquisition_source=?,internal_notes=? WHERE id=? AND company_code=? RETURNING ${customerColumns}`).bind(...bindValues,id,companyCode)
      :db.prepare(`INSERT INTO customers (account_id,company_code,customer_code,account_number,salesman_id,price_list_id,name,status,trading_name,customer_type,mof_number,company_registration_number,preferred_language,phone,mobile,email,website,address,city,country,default_currency,payment_terms,credit_limit,default_discount,customer_group,territory,default_payment_method,vat_treatment,tax_registration_status,statement_delivery,statement_email,allow_credit_sales,apply_withholding_tax,credit_hold,block_invoices,warn_credit_limit,require_po_number,tags,acquisition_source,internal_notes) VALUES ((SELECT id FROM accounts WHERE company_code=? AND account_number=?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING ${customerColumns}`).bind(companyCode,values.accountNumber,companyCode,...bindValues));
    const customerResultIndex=statements.length-1;
    if(update)statements.push(db.prepare("UPDATE accounts SET name=? WHERE company_code=? AND id=(SELECT account_id FROM customers WHERE id=? AND company_code=?) AND managed=1").bind(values.name,companyCode,id,companyCode));
    if(unchanged)statements.push(unchanged.clear);
    if(generated)statements.push(...generated.after);
    const results=await db.batch(statements);
    if(results.some(result=>!result.success))throw new Error("Could not save customer and account");
    const customer=results[customerResultIndex]?.results?.[0] as {id?:number}|undefined;
    const customerId=Number(customer?.id);
    if(!customerId)return Response.json({error:"Customer not found"},{status:404});

    const related:D1PreparedStatement[]=[];
    if(values.contacts){
      related.push(db.prepare("DELETE FROM customer_contacts WHERE customer_id=? AND company_code=?").bind(customerId,companyCode));
      related.push(...values.contacts.map(row=>db.prepare("INSERT INTO customer_contacts(company_code,customer_id,name,role,phone,email,receives) VALUES(?,?,?,?,?,?,?)").bind(companyCode,customerId,row.name,row.role,row.phone,row.email,row.receives)));
    }
    if(values.addresses){
      related.push(db.prepare("DELETE FROM customer_addresses WHERE customer_id=? AND company_code=?").bind(customerId,companyCode));
      related.push(...values.addresses.map(row=>db.prepare("INSERT INTO customer_addresses(company_code,customer_id,address_type,label,line1,line2,city,region,postal_code,country) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(companyCode,customerId,row.addressType,row.label,row.line1,row.line2,row.city,row.region,row.postalCode,row.country)));
    }
    if(related.length){const saved=await db.batch(related);if(saved.some(result=>!result.success))throw new Error("Could not save customer contacts or addresses");}
    return Response.json({customer:await db.prepare(`SELECT ${customerColumns} FROM customers WHERE id=? AND company_code=?`).bind(customerId,companyCode).first()},{status:update?200:201});
  }catch(error){
    console.error(error);
    const message=error instanceof Error?error.message:String(error);
    if(/UNIQUE constraint failed: accounts/.test(message))return Response.json({error:"COA: Generated account already exists for an unrelated record. Refresh and review the account code."},{status:409});
    if(/UNIQUE constraint failed: customers|customers_(customer_code|company_code)_unique/i.test(message))return Response.json({error:"Customer code is already in use"},{status:409});
    return Response.json({error:message.includes("COA:")?message.slice(message.indexOf("COA:")):"Could not save customer. Please try again."},{status:400});
  }
}

export const POST=(request:Request)=>write(request,false);
export const PUT=(request:Request)=>write(request,true);
