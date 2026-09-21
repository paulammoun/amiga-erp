import {newPartyAccount,accountAssertion} from "../../../db/coa-write";
import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";

function values(body: Record<string, unknown>) {
  const supplierCode = String(body.code ?? "").trim().toUpperCase();
  const accountNumber = String(body.accountNumber ?? "").trim();
  const name = String(body.name ?? "").trim();
  const mofNumber = String(body.mofNumber ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const address = String(body.address ?? "").trim();
  if (!name) throw new Error("Supplier name is required.");
  if (supplierCode.length > 40 || accountNumber.length > 100 || [name, mofNumber, phone, email, address].some(value => value.length > 2000)) throw new Error("Supplier details are too long.");
  return { supplierCode, accountNumber, name, mofNumber, phone, email, address };
}

const columns = "id,COALESCE(supplier_code,printf('SUP-%05d',id)) AS code,account_number AS accountNumber,account_id AS accountId,name,mof_number AS mofNumber,phone,email,address,created_at AS createdAt";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try { return Response.json({ suppliers: (await getRawDb().prepare(`SELECT ${columns} FROM suppliers WHERE company_code=? ORDER BY name COLLATE NOCASE`).bind(auth.companyCode.toLowerCase()).all()).results }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load suppliers." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const value = values(await request.json() as Record<string, unknown>), db = getRawDb();
    if(!/^[0-9]{6}$/.test(value.supplierCode))throw new Error("Supplier code must contain exactly 6 digits, including leading zeros.");
    if(await db.prepare('SELECT id FROM suppliers WHERE company_code=? AND supplier_code=?').bind(auth.companyCode.toLowerCase(),value.supplierCode).first())return Response.json({error:'This supplier code already exists.'},{status:409});
    const company=auth.companyCode.toLowerCase(),generated=await newPartyAccount(db,company,'supplier',value.supplierCode,value.name);
    const result=await db.batch([...generated.before,db.prepare("INSERT INTO suppliers (account_id,company_code,supplier_code,account_number,name,mof_number,phone,email,address) VALUES ((SELECT id FROM accounts WHERE company_code=? AND account_number=?),?,?,?,?,?,?,?,?) RETURNING "+columns).bind(company,generated.number,company,value.supplierCode,generated.number,value.name,value.mofNumber,value.phone,value.email,value.address),...generated.after]);
    const supplier=result[generated.before.length].results[0];
    return Response.json({ supplier: await db.prepare(`SELECT ${columns} FROM suppliers WHERE id=? AND company_code=?`).bind((supplier as {id:number}).id,auth.companyCode.toLowerCase()).first() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create supplier.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This supplier code already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>, id = Number(body.id), value = values(body);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid supplier." }, { status: 400 });
    const old=await getRawDb().prepare("SELECT supplier_code AS code,account_number AS accountNumber,account_id AS accountId FROM suppliers WHERE id=? AND company_code=?").bind(id,auth.companyCode.toLowerCase()).first<{code:string;accountNumber:string;accountId:number|null}>();
    if(!old)return Response.json({error:"Supplier not found."},{status:404});
    if((old.accountId||old.accountNumber)&&value.supplierCode!==old.code)throw new Error("This supplier already has an account. Its code cannot change because the linked account number must be preserved.");
    if(value.supplierCode!==old.code&&!/^[0-9]{6}$/.test(value.supplierCode))throw new Error("Supplier code must contain exactly 6 digits.");
    value.accountNumber=old.accountNumber;
    const db=getRawDb(),company=auth.companyCode.toLowerCase(),guard=accountAssertion(db,"EXISTS(SELECT 1 FROM suppliers WHERE id=? AND company_code=? AND supplier_code IS ? AND account_number=? AND account_id IS ?)",[id,company,old.code,old.accountNumber,old.accountId]);
    const results=await db.batch([guard.check,db.prepare("UPDATE suppliers SET supplier_code=NULLIF(?,''),name=?,mof_number=?,phone=?,email=?,address=? WHERE id=? AND company_code=? RETURNING "+columns).bind(value.supplierCode,value.name,value.mofNumber,value.phone,value.email,value.address,id,company),db.prepare("UPDATE accounts SET name=? WHERE id=? AND company_code=? AND managed=1").bind(value.name,old.accountId,company),guard.clear]);
    const supplier=results[1].results[0];
    if (!supplier) return Response.json({ error: "Supplier not found." }, { status: 404 });
    return Response.json({ supplier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update supplier.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This supplier code already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 400 });
  }
}
