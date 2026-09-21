import {ensureWarehouses} from './warehouses';
import { getRawDb } from "./index";

// Imported documents establish an audit baseline, never a second stock movement.
// D1 batch serialization and the final company marker make concurrent initialization safe.
export const STOCK_BACKFILL_SQL = [
`INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity,notes)
SELECT i.company_code,i.id,'opening','Opening balance','',i.stock_qty
 -COALESCE((SELECT SUM(l.quantity) FROM purchase_invoice_lines l JOIN purchase_invoices p ON p.id=l.purchase_invoice_id WHERE l.item_id=i.id AND p.company_code=i.company_code),0)
 +COALESCE((SELECT SUM(l.quantity) FROM invoice_lines l JOIN invoices p ON p.id=l.invoice_id WHERE l.item_id=i.id AND l.line_type='part' AND p.company_code=i.company_code),0),
 'Reconciled opening balance; includes earlier manual changes and preserves stock on hand at ledger introduction.' FROM items i WHERE i.company_code=? AND NOT EXISTS(SELECT 1 FROM stock_transactions WHERE company_code=? AND transaction_type='opening');`,
`INSERT INTO stock_transactions(company_code,item_id,transaction_type,source_id,source_line_id,reference,transaction_date,quantity,unit_cost,currency,notes,created_at)
SELECT p.company_code,l.item_id,'purchase',p.id,l.id,p.purchase_number,p.purchase_date,l.quantity,l.unit_cost,p.currency,'Imported existing purchase',p.created_at
FROM purchase_invoice_lines l JOIN purchase_invoices p ON p.id=l.purchase_invoice_id JOIN items i ON i.id=l.item_id AND i.company_code=p.company_code WHERE p.company_code=? AND NOT EXISTS(SELECT 1 FROM stock_transactions WHERE company_code=? AND transaction_type='opening') ORDER BY p.purchase_date,p.id,l.id;`,
`INSERT INTO stock_transactions(company_code,item_id,transaction_type,source_id,source_line_id,reference,transaction_date,quantity,unit_sale_price,currency,notes,created_at)
SELECT p.company_code,l.item_id,'sale',p.id,l.id,p.invoice_number,p.invoice_date,-l.quantity,l.unit_price,(SELECT default_currency FROM workshop_settings WHERE company_code=p.company_code),'Imported existing sale',p.created_at
FROM invoice_lines l JOIN invoices p ON p.id=l.invoice_id JOIN items i ON i.id=l.item_id AND i.company_code=p.company_code WHERE l.line_type='part' AND p.company_code=? AND NOT EXISTS(SELECT 1 FROM stock_transactions WHERE company_code=? AND transaction_type='opening') ORDER BY p.created_at,p.id,l.id;`
] as const;

export async function ensureStockLedger(companyCode:string,db=getRawDb()){
 const company=companyCode.toLowerCase();
 await ensureWarehouses(company,db);
 if(await db.prepare("SELECT id FROM stock_transactions WHERE company_code=? AND transaction_type='opening' LIMIT 1").bind(company).first())return;
 await db.batch([
  ...[STOCK_BACKFILL_SQL[1],STOCK_BACKFILL_SQL[2],STOCK_BACKFILL_SQL[0]].map(sql=>db.prepare(sql).bind(company,company)),
 ]);
}

/** Include these statements in the SAME D1 batch as the document line writes. */
export function documentStock(db:ReturnType<typeof getRawDb>,kind:"purchase"|"sale",reference:string,company:string,guard?:{invoiceId:number;editToken:string}){
 const purchase=kind==="purchase";
 const parent=purchase?"purchase_invoices":"invoices",lines=purchase?"purchase_invoice_lines":"invoice_lines",fk=purchase?"purchase_invoice_id":"invoice_id",number=purchase?"purchase_number":"invoice_number";
 const sign=purchase?1:-1;
 const warehouseGuard='warehouse:'+crypto.randomUUID();
 const guardSql=!purchase&&guard?" AND EXISTS(SELECT 1 FROM invoices g WHERE g.id=? AND g.company_code=? AND g.edit_token=?)":"";
 const guardBind=!purchase&&guard?[guard.invoiceId,company,guard.editToken]:[];
 const where=(purchase?"":" AND l.line_type='part' AND l.item_id IS NOT NULL")+guardSql;
 const date=purchase?"p.purchase_date":"p.invoice_date",cost=purchase?"COALESCE(l.landed_unit_cost,l.unit_cost)/l.unit_factor":"NULL",salePrice=purchase?"NULL":"l.unit_price/l.unit_factor",currency=purchase?"p.currency":"(SELECT default_currency FROM workshop_settings WHERE company_code=p.company_code)";
 return [
  db.prepare(`INSERT INTO item_master_guards(token,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM warehouses w WHERE w.company_code=p.company_code AND w.code=p.warehouse_code AND w.active=1) THEN 1 ELSE NULL END FROM ${parent} p WHERE p.${number}=? AND p.company_code=?`).bind(warehouseGuard,reference,company),
  db.prepare(`INSERT INTO stock_transactions(company_code,item_id,transaction_type,source_id,source_line_id,reference,transaction_date,quantity,unit_cost,unit_sale_price,currency,notes,warehouse_code)
   SELECT p.company_code,l.item_id,?,p.id,l.id,p.${number},${date},?*l.quantity*l.unit_factor,${cost},${salePrice},${currency},?,p.warehouse_code
   FROM ${lines} l JOIN ${parent} p ON p.id=l.${fk} JOIN items i ON i.id=l.item_id AND i.company_code=p.company_code
   WHERE p.${number}=? AND p.company_code=?${where}`)
   .bind(kind,sign,"",reference,company,...guardBind),
  db.prepare(`UPDATE items SET stock_qty=stock_qty+?*(
    SELECT COALESCE(SUM(l.quantity*l.unit_factor),0) FROM ${lines} l JOIN ${parent} p ON p.id=l.${fk}
    WHERE p.${number}=? AND p.company_code=? AND l.item_id=items.id${where}
   ) WHERE company_code=? AND id IN (
    SELECT l.item_id FROM ${lines} l JOIN ${parent} p ON p.id=l.${fk} WHERE p.${number}=? AND p.company_code=?${where}
   )`).bind(sign,reference,company,...guardBind,company,reference,company,...guardBind),
  db.prepare('DELETE FROM item_master_guards WHERE token=?').bind(warehouseGuard)
 ];
}

/** Undo the old document's stock effect, then remove its ledger rows before replacement. */
export function removeDocumentStock(db:ReturnType<typeof getRawDb>,kind:"purchase"|"sale",reference:string,company:string,guard?:{invoiceId:number;editToken:string}){
 const guardSql=kind==="sale"&&guard?" AND EXISTS(SELECT 1 FROM invoice_edit_guards g WHERE g.invoice_id=? AND g.edit_token=?)":"";
 const guardBind=kind==="sale"&&guard?[guard.invoiceId,guard.editToken]:[];
 return [
  db.prepare(`UPDATE items SET stock_qty=stock_qty-(
   SELECT COALESCE(SUM(t.quantity),0) FROM stock_transactions t
   WHERE t.company_code=? AND t.transaction_type=? AND t.reference=? AND t.item_id=items.id${guardSql}
  ) WHERE company_code=? AND id IN (
   SELECT item_id FROM stock_transactions WHERE company_code=? AND transaction_type=? AND reference=?${guardSql}
  )`).bind(company,kind,reference,...guardBind,company,company,kind,reference,...guardBind),
  db.prepare(`DELETE FROM stock_transactions WHERE company_code=? AND transaction_type=? AND reference=?${guardSql}`).bind(company,kind,reference,...guardBind),
 ];
}

