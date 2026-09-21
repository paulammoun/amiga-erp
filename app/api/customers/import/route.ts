import {newPartyAccount,accountAssertion} from "../../../../db/coa-write";
import { getRawDb } from "../../../../db";
import { requireUser } from "../../../../db/auth";
import { getWorkshopSettings } from "../../../../db/settings";
import { ensureDefaultPriceList } from "../../../../db/price-lists";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim()));
}

const aliases: Record<string, string[]> = {
  code: ["code", "customercode"],
  accountNumber: ["accountnumber", "accountno", "account", "glaccount"],
  salesmanCode: ["salesmancode", "salesman", "salesrepresentative", "representative"],
  priceListCode: ["pricelistcode", "pricelist", "pricecode"],
  name: ["name", "customername"],
  mofNumber: ["mof", "mofnumber", "taxnumber", "vatnumber"],
  phone: ["phone", "phonenumber", "mobile"],
  email: ["email", "emailaddress"],
  address: ["address", "customeraddress"],
};

const normalize = (value: string) => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const text = await request.text();
    if (!text.trim()) return Response.json({ error: "Choose a CSV file that contains customers." }, { status: 400 });
    if (text.length > 2_000_000) return Response.json({ error: "The CSV file is too large." }, { status: 413 });
    const rows = parseCsv(text);
    if (rows.length < 2) return Response.json({ error: "The CSV needs a header row and at least one customer." }, { status: 400 });
    const headers = rows[0].map(normalize);
    const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex(header => names.includes(header))])) as Record<string, number>;
    if (indexes.name < 0) return Response.json({ error: "The CSV must include a Name or Customer Name column." }, { status: 400 });
    const customers = rows.slice(1).map((values, index) => {
      const get = (key: string) => indexes[key] >= 0 ? String(values[indexes[key]] ?? "").trim() : "";
      const customer = { row: index + 2, code: get("code").toUpperCase(), accountNumber: get("accountNumber"), salesmanCode:get("salesmanCode").toUpperCase(), priceListCode:get("priceListCode").toUpperCase(), name: get("name"), mofNumber: get("mofNumber"), phone: get("phone"), email: get("email"), address: get("address") };
      if (!customer.name) throw new Error(`Row ${customer.row}: customer name is required.`);
      if (!/^[0-9]{6}$/.test(customer.code)) throw new Error(`Row ${customer.row}: invalid customer code.`);
      if (customer.mofNumber.length > 100) throw new Error(`Row ${customer.row}: MOF number is too long.`);
      if (customer.accountNumber.length > 100) throw new Error(`Row ${customer.row}: account number is too long.`);
      if ([customer.name, customer.phone, customer.email, customer.address].some(value => value.length > 2000)) throw new Error(`Row ${customer.row}: customer details are too long.`);
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error(`Row ${customer.row}: invalid email address.`);
      return customer;
    });
    if (customers.length > 500) return Response.json({ error: "Import up to 500 customers at a time." }, { status: 400 });
    const db = getRawDb(),company=auth.companyCode.toLowerCase(),defaultPriceListId=await ensureDefaultPriceList(company,db),salesmen=await db.prepare("SELECT id,salesman_code AS code FROM salesmen WHERE company_code=? AND active=1").bind(company).all<{id:number;code:string}>(),salesmanByCode=new Map(salesmen.results.map(salesman=>[salesman.code.toUpperCase(),salesman.id])),fallback=salesmanByCode.get("UNASSIGNED");
    const withSalesman=customers.map(customer=>{const salesmanId=salesmanByCode.get(customer.salesmanCode)||(!customer.salesmanCode?fallback:undefined);if(!salesmanId)throw new Error(`Row ${customer.row}: enter a valid active Salesman Code.`);return{...customer,salesmanId}});
    const priceLists=await db.prepare("SELECT id,code FROM price_lists WHERE company_code=?").bind(company).all<{id:number;code:string}>(),priceListByCode=new Map(priceLists.results.map(list=>[list.code.toUpperCase(),list.id]));
    const ready=withSalesman.map(customer=>{const priceListId=customer.priceListCode?priceListByCode.get(customer.priceListCode):defaultPriceListId;if(!priceListId)throw new Error(`Row ${customer.row}: enter a valid Price List Code.`);return{...customer,priceListId}});
    const settings=await getWorkshopSettings(company,db);
    const statements:D1PreparedStatement[]=[];
    if(new Set(ready.map(c=>c.code)).size!==ready.length)throw new Error("Duplicate customer codes in this import. Keep one row per code.");
    for(const customer of ready){
     const old=await db.prepare("SELECT id,account_id AS accountId,account_number AS accountNumber FROM customers WHERE company_code=? AND customer_code=?").bind(company,customer.code).first<{id:number;accountId:number|null;accountNumber:string}>();
     if(old){
      if(customer.accountNumber&&customer.accountNumber!==old.accountNumber)throw new Error("Row "+customer.row+": existing account numbers cannot change.");
      const guard=accountAssertion(db,"EXISTS(SELECT 1 FROM customers WHERE id=? AND company_code=? AND customer_code=? AND account_id IS ?)",[old.id,company,customer.code,old.accountId]);
      statements.push(guard.check,db.prepare("UPDATE customers SET salesman_id=?,price_list_id=?,name=?,mof_number=?,phone=?,email=?,address=? WHERE id=? AND company_code=?").bind(customer.salesmanId,customer.priceListId,customer.name,customer.mofNumber,customer.phone,customer.email,customer.address,old.id,company),db.prepare("UPDATE accounts SET name=? WHERE id=? AND company_code=? AND managed=1").bind(customer.name,old.accountId,company),guard.clear);
     }else{
      const generated=await newPartyAccount(db,company,'customer',customer.code,customer.name);
      if(customer.accountNumber&&customer.accountNumber!==generated.number)throw new Error("Row "+customer.row+": generated account must be "+generated.number+".");
      statements.push(...generated.before,db.prepare("INSERT INTO customers(account_id,company_code,customer_code,account_number,salesman_id,price_list_id,name,mof_number,phone,email,address,default_currency) VALUES((SELECT id FROM accounts WHERE company_code=? AND account_number=?),?,?,?,?,?,?,?,?,?,?,?)").bind(company,generated.number,company,customer.code,generated.number,customer.salesmanId,customer.priceListId,customer.name,customer.mofNumber,customer.phone,customer.email,customer.address,settings.defaultCurrency),...generated.after);
     }
    }
    const results=await db.batch(statements);
    if(results.some(result=>!result.success))throw new Error("Could not import customers and their accounts.");
    return Response.json({ imported: customers.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not import customers." }, { status: 400 });
  }
}
