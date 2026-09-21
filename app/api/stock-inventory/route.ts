import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { getWorkshopSettings } from "../../../db/settings";
import { ensureStockLedger } from "../../../db/stock";

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;
  const warehouseCode=params.get('warehouseCode')??'';
  const from = params.get("from") ?? "", to = params.get("to") ?? "";
  if (!validDate(from) || !validDate(to) || from > to)
    return Response.json({ error: "Choose a valid From and To date." }, { status: 400 });

  try {
    const company = auth.companyCode.toLowerCase(), db = getRawDb();
    await ensureStockLedger(company, db);
    const [result, settings] = await Promise.all([
      db.prepare(`WITH movement AS (
        SELECT item_id,
          SUM(CASE WHEN transaction_date='' OR transaction_date<? THEN quantity ELSE 0 END) AS openingQty,
          SUM(CASE WHEN transaction_date>=? AND quantity>0 THEN quantity ELSE 0 END) AS periodIn,
          SUM(CASE WHEN transaction_date>=? AND quantity<0 THEN -quantity ELSE 0 END) AS periodOut
        FROM stock_transactions
        WHERE company_code=? AND (?='' OR warehouse_code=?) AND (transaction_date='' OR transaction_date<=?)
        GROUP BY item_id
      ), purchase_cost AS (
        SELECT t.item_id, SUM(t.quantity) AS quantity,
          SUM(t.quantity*t.unit_cost*source_currency.rate/default_currency.rate) AS total
        FROM stock_transactions t JOIN workshop_settings s ON s.company_code=t.company_code
        JOIN currencies source_currency ON source_currency.company_code=t.company_code AND source_currency.code=t.currency
        JOIN currencies default_currency ON default_currency.company_code=t.company_code AND default_currency.code=s.default_currency
        WHERE t.company_code=? AND t.transaction_type='purchase' AND t.quantity>0
          AND t.unit_cost IS NOT NULL AND t.transaction_date<=?
          AND source_currency.rate>0 AND default_currency.rate>0
        GROUP BY t.item_id
      )
      SELECT i.id,i.sku,i.name,i.brand,
        COALESCE(m.openingQty,0) AS openingQty,
        COALESCE(m.periodIn,0) AS periodIn,
        COALESCE(m.periodOut,0) AS periodOut,
        COALESCE(m.openingQty,0)+COALESCE(m.periodIn,0)-COALESCE(m.periodOut,0) AS closingQty,
        CASE WHEN COALESCE(c.quantity,0)>0 THEN ROUND(c.total/c.quantity,4) ELSE NULL END AS averageCost
      FROM items i
      LEFT JOIN movement m ON m.item_id=i.id
      LEFT JOIN purchase_cost c ON c.item_id=i.id
      WHERE i.company_code=?
      ORDER BY i.sku COLLATE NOCASE`).bind(from, from, from, company, warehouseCode,warehouseCode,to, company, to, company).all(),
      getWorkshopSettings(company, db),
    ]);
    return Response.json({ warehouseCode,from, to, companyName: settings.companyName, currency: settings.defaultCurrency, items: result.results });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not prepare the stock inventory report." }, { status: 500 });
  }
}
