import {warehouseFor} from '../../../db/warehouses';
import {itemUnit} from '../../../db/item-master';
import {stockQuantity} from '../../../lib/item-master';
import { ensureStockLedger, documentStock, removeDocumentStock } from "../../../db/stock";
import { documentAccounting, removeDocumentAccounting } from "../../../db/accounting";
import { getRawDb } from "../../../db";
import { getWorkshopSettings } from "../../../db/settings";
import {getCurrency} from "../../../db/currencies";
import { requireUser } from "../../../db/auth";
import {purchaseCosts,roundMoney,type PurchaseExpense} from '../../../lib/purchase-costs';

type SavedCosts={warehouseCode:string;purchaseNumber:string;currency:string;currencyRate:number|null;localCurrency:string;expensesJson:string;taxOverride:number|null;lbpRate:number|null};

type PurchaseLineInput = { unit?:string; itemId?: number; description?: string; quantity?: number; unitCost?: number };

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    await ensureStockLedger(auth.companyCode);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!Number.isSafeInteger(Number(id)) || Number(id)<1) return Response.json({error:"Invalid purchase."},{status:400});
      const db=getRawDb();
      const purchase=await db.prepare("SELECT warehouse_code AS warehouseCode,id,purchase_number AS purchaseNumber,supplier_id AS supplierId,supplier_invoice_number AS supplierInvoiceNumber,purchase_date AS purchaseDate,currency,currency_rate AS currencyRate,local_currency AS localCurrency,tax_override AS taxOverride,lbp_rate AS lbpRate,total_lbp AS totalLbp,expenses_json AS expensesJson,expense_percent AS expensePercent,expenses_local AS expensesLocal,tax_rate AS taxRate,tax,total,notes FROM purchase_invoices WHERE id=? AND company_code=?").bind(Number(id),auth.companyCode.toLowerCase()).first<SavedCosts>();
      if(!purchase)return Response.json({error:"Purchase not found."},{status:404});
      const lines=await db.prepare("SELECT unit,unit_factor AS unitFactor,item_id AS itemId,description,quantity,unit_cost AS unitCost,COALESCE(landed_unit_cost,unit_cost) AS landedUnitCost FROM purchase_invoice_lines WHERE purchase_invoice_id=? ORDER BY id").bind(Number(id)).all();
      return Response.json({purchase:{...purchase,expenses:JSON.parse(purchase.expensesJson)},lines:lines.results});
    }
    const rows = await getRawDb().prepare(`
      SELECT p.id,p.purchase_number AS purchaseNumber,p.supplier_name AS supplierName,
             p.supplier_invoice_number AS supplierInvoiceNumber,p.purchase_date AS purchaseDate,
             p.warehouse_code AS warehouseCode,p.currency,p.subtotal,p.tax,p.total,COALESCE(p.total_lbp,CASE WHEN p.currency='LBP' THEN p.total WHEN p.local_currency='LBP' AND p.currency_rate>0 THEN ROUND(p.total*p.currency_rate,2) END) AS totalLbp,p.notes,p.created_at AS createdAt,COUNT(l.id) AS lineCount
       FROM purchase_invoices p
       LEFT JOIN purchase_invoice_lines l ON l.purchase_invoice_id=p.id
       WHERE p.company_code=?
       GROUP BY p.id
       ORDER BY p.purchase_date DESC,p.id DESC
       LIMIT 200
    `).bind(auth.companyCode.toLowerCase()).all();
    return Response.json({ purchases: rows.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load purchases." }, { status: 500 });
  }
}

export const POST = savePurchase;
export const PUT = savePurchase;

async function savePurchase(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  try {
    await ensureStockLedger(auth.companyCode);
    const body = await request.json() as { id?: number; warehouseCode?:string; supplierId?: number; supplierInvoiceNumber?: string; purchaseDate?: string; currency?: string; taxRate?: number; taxOverride?:number|null; notes?: string; lines?: PurchaseLineInput[];expenses?:PurchaseExpense[] };
    const editing=request.method==="PUT", id=Number(body.id);
    if(editing&&(!Number.isSafeInteger(id)||id<1))return Response.json({error:"Invalid purchase."},{status:400});
    const supplierId = Number(body.supplierId);
    const supplierInvoiceNumber = String(body.supplierInvoiceNumber ?? "").trim();
    const purchaseDate = String(body.purchaseDate ?? "").trim();
    const currency = String(body.currency ?? "USD").trim().toUpperCase();
    const notes = String(body.notes ?? "").trim();
    const taxRate = body.taxRate == null ? (await getWorkshopSettings(auth.companyCode)).defaultTax : Number(body.taxRate);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) return Response.json({ error: "Select a supplier." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return Response.json({ error: "Enter a valid purchase date." }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: "Select a currency from Company Configuration." }, { status: 400 });
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return Response.json({ error: "Purchase tax must be between 0 and 100." }, { status: 400 });
    if ([supplierInvoiceNumber, notes].some(value => value.length > 2000)) return Response.json({ error: "Purchase details are too long." }, { status: 400 });
    if (!Array.isArray(body.lines) || body.lines.length > 100) return Response.json({ error: "Add between 1 and 100 purchase lines." }, { status: 400 });
    const lines = body.lines.map(line => ({ unit:String(line.unit??''),unitFactor:1,itemId: Number(line.itemId), description: String(line.description ?? "").trim(), quantity: Number(line.quantity), unitCost: Number(line.unitCost) }));
    if (!lines.length || lines.some(line => !Number.isSafeInteger(line.itemId) || line.itemId < 1 || !line.description || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) return Response.json({ error: "Each line needs a part, a positive quantity, and a valid unit cost." }, { status: 400 });
    const db = getRawDb(), companyCode=auth.companyCode.toLowerCase(),currencyRecord=await getCurrency(companyCode,currency,db);
    if(!currencyRecord?.active)return Response.json({error:"Select an active currency from Company Configuration."},{status:400});
    const existing=editing?await db.prepare("SELECT warehouse_code AS warehouseCode,purchase_number AS purchaseNumber,currency,currency_rate AS currencyRate,local_currency AS localCurrency,tax_override AS taxOverride,lbp_rate AS lbpRate,total_lbp AS totalLbp,expenses_json AS expensesJson FROM purchase_invoices WHERE id=? AND company_code=?").bind(id,companyCode).first<SavedCosts>():null;
    if(editing&&!existing)return Response.json({error:"Purchase not found."},{status:404});
    const warehouseCode=await warehouseFor(db,companyCode,body.warehouseCode??existing?.warehouseCode);
    const settings=await getWorkshopSettings(companyCode),localCurrency=existing?.localCurrency||settings.localCurrency;
    if(localCurrency!==settings.localCurrency)return Response.json({error:"This purchase uses a previous local currency. Restore that local currency in Company Configuration before editing."},{status:400});
    const currencyRate=existing?.currency===currency&&existing.currencyRate?existing.currencyRate:Number(currencyRecord.rate);
    const lbpCurrency=await getCurrency(companyCode,'LBP',db);
    const lbpRate=currency==='LBP'?1:existing?.currency===currency&&existing.lbpRate?existing.lbpRate:localCurrency==='LBP'?currencyRate:lbpCurrency&&Number(lbpCurrency.rate)>0?currencyRate/Number(lbpCurrency.rate):null;
    const taxOverride=body.taxOverride===undefined?(existing?.taxOverride??null):body.taxOverride;
    if(taxOverride!==null&&(typeof taxOverride!=='number'||!Number.isFinite(taxOverride)||taxOverride<0||taxOverride>1e12))return Response.json({error:'Enter a valid non-negative tax total.'},{status:400});
    const savedExpenses:PurchaseExpense[]=JSON.parse(existing?.expensesJson||'[]');
    const inputExpenses=body.expenses??savedExpenses;
    if(!Array.isArray(inputExpenses)||inputExpenses.length>100)return Response.json({error:"Use no more than 100 expense lines."},{status:400});
    const expenses:PurchaseExpense[]=[];
    for(const input of inputExpenses){
      const category=String(input.category??'').trim(),description=String(input.description??'').trim(),code=String(input.currency??'').toUpperCase(),amount=Number(input.amount);
      if(!category||category.length>100||!description||description.length>2000||!Number.isFinite(amount)||amount<=0||amount>1e12)return Response.json({error:"Each expense needs a category, description, currency and positive amount."},{status:400});
      const saved=savedExpenses.find(e=>e.id===input.id&&e.currency===code),record=await getCurrency(companyCode,code,db);
      if(!saved&&!record?.active)return Response.json({error:"Select an active currency for each expense."},{status:400});
      const rate=saved?.rate??Number(record?.rate);
      if(!Number.isFinite(rate)||rate<=0)return Response.json({error:"Expense exchange rates must be positive."},{status:400});
      expenses.push({id:saved?.id??crypto.randomUUID(),category,description,currency:code,amount,rate,localAmount:roundMoney(amount*rate)});
    }
    if(!Number.isFinite(currencyRate)||currencyRate<=0)return Response.json({error:"Purchase exchange rate must be positive."},{status:400});
    const supplier = await db.prepare("SELECT name FROM suppliers WHERE id=? AND company_code=?").bind(supplierId,companyCode).first<{name:string}>();
    if (!supplier) return Response.json({ error: "Supplier not found." }, { status: 400 });
    for (const line of lines){Object.assign(line,await itemUnit(db,companyCode,line.itemId,line.unit,'purchase',supplierId));stockQuantity(line.quantity,line.unitFactor);}
    const subtotal = Number(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0).toFixed(2));
    const costs=purchaseCosts(lines,currencyRate,expenses);
    if(expenses.length&&costs.goodsLocal<=0)return Response.json({error:"Enter a positive goods subtotal before allocating expenses."},{status:400});
    if(!Number.isFinite(costs.landedLocal)||costs.landedLocal>1e12||costs.landedUnitCosts.some(n=>!Number.isFinite(n)||n>1e12))return Response.json({error:"Landed cost is too large."},{status:400});
    const tax=roundMoney(taxOverride??subtotal*taxRate/100),total=roundMoney(subtotal+tax);
    const totalLbp=lbpRate===null?null:roundMoney(total*lbpRate);
    if(totalLbp!==null&&(!Number.isFinite(totalLbp)||totalLbp>1e15))return Response.json({error:"LBP total is too large."},{status:400});
    if (!Number.isFinite(total) || total > 1e12) return Response.json({ error: "Purchase total is too large." }, { status: 400 });
    const oldItems=editing?(await db.prepare('SELECT item_id AS id FROM purchase_invoice_lines WHERE purchase_invoice_id=?').bind(id).all<{id:number}>()).results:[];
    const affectedItems=[...new Set([...oldItems.map(i=>i.id),...lines.map(l=>l.itemId)])];
    const next = await db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(purchase_number,5) AS INTEGER)),0)+1 AS id FROM purchase_invoices WHERE company_code=?").bind(companyCode).first<{id:number}>();
    const purchaseNumber = existing?.purchaseNumber ?? `PUR-${String(Number(next?.id ?? 1)).padStart(6, "0")}`;
    const statements = editing ? [
      ...removeDocumentStock(db,"purchase",purchaseNumber,companyCode),
      ...removeDocumentAccounting(db,"purchase",purchaseNumber,companyCode),
      // Reverse old lines before changing date/currency, retaining their original cost context.
      db.prepare("DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id=?").bind(id),
      db.prepare("UPDATE purchase_invoices SET supplier_id=?,supplier_name=?,supplier_invoice_number=?,purchase_date=?,currency=?,subtotal=?,tax_rate=?,tax=?,total=?,notes=? WHERE id=? AND company_code=?").bind(supplierId,supplier.name,supplierInvoiceNumber,purchaseDate,currency,subtotal,taxRate,tax,total,notes,id,companyCode),
    ] : [db.prepare("INSERT INTO purchase_invoices (company_code,purchase_number,supplier_id,supplier_name,supplier_invoice_number,purchase_date,currency,subtotal,tax_rate,tax,total,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(companyCode,purchaseNumber,supplierId,supplier.name,supplierInvoiceNumber,purchaseDate,currency,subtotal,taxRate,tax,total,notes)];
    statements.push(db.prepare("UPDATE purchase_invoices SET warehouse_code=?,tax_override=?,lbp_rate=?,total_lbp=?,expenses_json=?,currency_rate=?,local_currency=?,expense_percent=?,expenses_local=? WHERE purchase_number=? AND company_code=?").bind(warehouseCode,taxOverride===null?null:roundMoney(taxOverride),lbpRate,totalLbp,JSON.stringify(expenses),currencyRate,localCurrency,costs.expensePercent,costs.expensesLocal,purchaseNumber,companyCode));
    statements.push(...lines.map((line,index)=>db.prepare("INSERT INTO purchase_invoice_lines (purchase_invoice_id,item_id,description,quantity,unit_cost,line_total,unit,unit_factor,landed_unit_cost) VALUES ((SELECT id FROM purchase_invoices WHERE purchase_number=? AND company_code=?),?,?,?,?,?,?,?,?)").bind(purchaseNumber,companyCode,line.itemId,line.description,line.quantity,line.unitCost,Number((line.quantity*line.unitCost).toFixed(2)),line.unit,line.unitFactor,costs.landedUnitCosts[index])));
    statements.push(...documentStock(db,"purchase",purchaseNumber,companyCode));
    if(editing){const guard='purchase-stock:'+crypto.randomUUID();statements.push(db.prepare(`INSERT INTO item_master_guards(token,valid) VALUES(?,CASE WHEN (SELECT negative_stock_policy FROM workshop_settings WHERE company_code=?)<>'block' OR NOT EXISTS(SELECT item_id FROM stock_transactions WHERE company_code=? AND warehouse_code IN (?,?) AND item_id IN (${affectedItems.map(()=>'?').join(',')}) GROUP BY warehouse_code,item_id HAVING SUM(quantity)<-0.000000001) THEN 1 ELSE NULL END)`).bind(guard,companyCode,companyCode,warehouseCode,existing!.warehouseCode,...affectedItems),db.prepare('DELETE FROM item_master_guards WHERE token=?').bind(guard))}
    statements.push(...documentAccounting(db,"purchase",purchaseNumber,companyCode));
    await db.batch(statements);
    const purchase = await db.prepare("SELECT warehouse_code AS warehouseCode,id,purchase_number AS purchaseNumber,supplier_name AS supplierName,supplier_invoice_number AS supplierInvoiceNumber,purchase_date AS purchaseDate,currency,subtotal,tax,total,tax_override AS taxOverride,lbp_rate AS lbpRate,total_lbp AS totalLbp,notes,created_at AS createdAt FROM purchase_invoices WHERE purchase_number=? AND company_code=?").bind(purchaseNumber,companyCode).first();
    return Response.json({ purchase }, { status: editing ? 200 : 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: /item_master_guards/.test(String(error))?'This change would leave insufficient warehouse stock, or the warehouse became inactive. Refresh and try again.':error instanceof Error?error.message:"Could not register the purchase. Please try again." }, { status: 500 });
  }
}
