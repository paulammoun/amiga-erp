import { getRawDb } from "./index";

export type CurrencyRecord = {
  id: number;
  code: string;
  name: string;
  rate: number;
  active: boolean;
};

const columns = "id,code,name,rate,active";

export async function ensureCompanyCurrencies(companyCode: string, db: D1Database = getRawDb()) {
  const company = companyCode.toLowerCase();
  const settings = await db.prepare("SELECT default_currency AS defaultCurrency,local_currency AS localCurrency,local_currency_rate AS legacyRate FROM workshop_settings WHERE company_code=? LIMIT 1")
    .bind(company).first<{defaultCurrency:string;localCurrency:string;legacyRate:number}>();
  const defaultCurrency = String(settings?.defaultCurrency || "USD").toUpperCase();
  const localCurrency = String(settings?.localCurrency || defaultCurrency).toUpperCase();
  const legacyRate = Number(settings?.legacyRate || 1);
  const statements = [
    db.prepare("INSERT INTO currencies(company_code,code,name,rate,active) VALUES(?,?,?,?,1) ON CONFLICT(company_code,code) DO NOTHING")
      .bind(company, localCurrency, localCurrency, 1),
  ];
  if (defaultCurrency !== localCurrency) {
    statements.push(db.prepare("INSERT INTO currencies(company_code,code,name,rate,active) VALUES(?,?,?,?,1) ON CONFLICT(company_code,code) DO NOTHING")
      .bind(company, defaultCurrency, defaultCurrency, Number.isFinite(legacyRate) && legacyRate > 0 ? legacyRate : 1));
  }
  await db.batch(statements);
}

export async function getCurrencies(companyCode: string, db: D1Database = getRawDb()) {
  await ensureCompanyCurrencies(companyCode, db);
  const result = await db.prepare(`SELECT ${columns} FROM currencies WHERE company_code=? ORDER BY active DESC,code COLLATE NOCASE`)
    .bind(companyCode.toLowerCase()).all<CurrencyRecord>();
  return result.results;
}

export async function getCurrency(companyCode: string, code: string, db: D1Database = getRawDb()) {
  return db.prepare(`SELECT ${columns} FROM currencies WHERE company_code=? AND code=? LIMIT 1`)
    .bind(companyCode.toLowerCase(), code.toUpperCase()).first<CurrencyRecord>();
}
