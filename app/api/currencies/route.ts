import { requireUser } from "../../../db/auth";
import { ensureCompanyCurrencies, getCurrencies } from "../../../db/currencies";
import { getRawDb } from "../../../db";

const columns = "id,code,name,rate,active";

function values(body: Record<string, unknown>) {
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const rate = Number(body.rate);
  const active = body.active === undefined || body.active === true || body.active === 1;
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Use a three-letter currency code, such as USD or LBP.");
  try { new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(0); }
  catch { throw new Error("Enter a valid currency code."); }
  if (!name || name.length > 100) throw new Error("Enter a currency name of 100 characters or fewer.");
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e12) throw new Error("Enter a rate greater than zero.");
  return { code, name, rate, active };
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try { return Response.json({ currencies: await getCurrencies(auth.companyCode) }); }
  catch (error) { console.error(error); return Response.json({ error: "Could not load currencies." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const value = values(await request.json() as Record<string, unknown>);
    const db = getRawDb(), company = auth.companyCode.toLowerCase();
    await ensureCompanyCurrencies(company, db);
    const settings = await db.prepare("SELECT local_currency AS localCurrency FROM workshop_settings WHERE company_code=?").bind(company).first<{localCurrency:string}>();
    const rate = value.code === settings?.localCurrency ? 1 : value.rate;
    const currency = await db.prepare(`INSERT INTO currencies(company_code,code,name,rate,active) VALUES(?,?,?,?,?) RETURNING ${columns}`)
      .bind(company, value.code, value.name, rate, value.active ? 1 : 0).first();
    return Response.json({ currency }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add currency.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This currency already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    const body = await request.json() as Record<string, unknown>, id = Number(body.id), value = values(body);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid currency." }, { status: 400 });
    const db = getRawDb(), company = auth.companyCode.toLowerCase();
    const existing = await db.prepare("SELECT code FROM currencies WHERE id=? AND company_code=?").bind(id, company).first<{code:string}>();
    if (!existing) return Response.json({ error: "Currency not found." }, { status: 404 });
    if (value.code !== existing.code) return Response.json({ error: "Currency codes cannot be changed after creation." }, { status: 409 });
    const settings = await db.prepare("SELECT default_currency AS defaultCurrency,local_currency AS localCurrency FROM workshop_settings WHERE company_code=?").bind(company).first<{defaultCurrency:string;localCurrency:string}>();
    if (existing.code === settings?.localCurrency && value.code !== existing.code) return Response.json({ error: "Change the local currency in Configuration before renaming it." }, { status: 409 });
    if (existing.code === settings?.defaultCurrency && value.code !== existing.code) return Response.json({ error: "Change the default currency in Configuration before renaming it." }, { status: 409 });
    if (!value.active && (existing.code === settings?.localCurrency || existing.code === settings?.defaultCurrency)) return Response.json({ error: "The default and local currencies must remain active." }, { status: 409 });
    const rate = value.code === settings?.localCurrency ? 1 : value.rate;
    const currency = await db.prepare(`UPDATE currencies SET code=?,name=?,rate=?,active=? WHERE id=? AND company_code=? RETURNING ${columns}`)
      .bind(value.code, value.name, rate, value.active ? 1 : 0, id, company).first();
    return Response.json({ currency });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update currency.";
    return Response.json({ error: /UNIQUE/i.test(message) ? "This currency already exists." : message }, { status: /UNIQUE/i.test(message) ? 409 : 400 });
  }
}
