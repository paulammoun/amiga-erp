import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
import {ensureStockLedger} from '../../../db/stock';
import {decodeMaster} from '../../../db/item-master';

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 const params=new URL(request.url).searchParams,itemId=Number(params.get('itemId')),page=Number(params.get('page')||1),transactionId=Number(params.get('transactionId')||0);
 if(!Number.isSafeInteger(itemId)||itemId<1||!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(transactionId)||transactionId<0)return Response.json({error:'Invalid item or page.'},{status:400});
 try{
  const db=getRawDb(),company=auth.companyCode.toLowerCase();
  const item=await db.prepare('SELECT * FROM items WHERE id=? AND company_code=?').bind(itemId,company).first<Record<string,unknown>>();
  if(!item)return Response.json({error:'Item not found.'},{status:404});
  await ensureStockLedger(company,db);
  if(transactionId){
   const row=await db.prepare('SELECT * FROM stock_transactions WHERE id=? AND item_id=? AND company_code=?').bind(transactionId,itemId,company).first<Record<string,unknown>>();
   if(!row)return Response.json({error:'Transaction not found.'},{status:404});
   let document:Record<string,unknown>|null=null,lines:unknown[]=[],printUrl:string|null=null;
   if(row.transaction_type==='purchase'&&row.source_id){
    document=await db.prepare('SELECT purchase_number AS reference,purchase_date AS date,supplier_name AS party,currency,subtotal,tax,total,notes FROM purchase_invoices WHERE id=? AND company_code=?').bind(row.source_id,company).first();
    if(document)lines=(await db.prepare('SELECT description,quantity,unit,unit_cost AS price,quantity*unit_cost AS amount FROM purchase_invoice_lines WHERE purchase_invoice_id=? ORDER BY id').bind(row.source_id).all()).results;
   }else if(row.transaction_type==='sale'&&row.source_id){
    document=await db.prepare('SELECT p.invoice_number AS reference,p.invoice_date AS date,c.name AS party,p.currency,p.subtotal,p.tax,p.total,p.notes FROM invoices p LEFT JOIN customers c ON c.id=p.customer_id AND c.company_code=p.company_code WHERE p.id=? AND p.company_code=?').bind(row.source_id,company).first();
    if(document){lines=(await db.prepare('SELECT description,quantity,unit,unit_price AS price,line_total AS amount FROM invoice_lines WHERE invoice_id=? ORDER BY id').bind(row.source_id).all()).results;printUrl='/invoice-print?id='+Number(row.source_id);}
   }
   if(!document){
    document={reference:row.reference,date:row.transaction_date,notes:row.notes};
    const transfer=row.transaction_type==='transfer_in'||row.transaction_type==='transfer_out';
    lines=(await db.prepare(`SELECT i.sku||' · '||i.name AS description,t.quantity,COALESCE(json_extract(i.master_json,'$.baseUnit'),'unit') AS unit,t.warehouse_code AS warehouse FROM stock_transactions t JOIN items i ON i.id=t.item_id AND i.company_code=t.company_code WHERE t.company_code=? AND ${transfer?"t.reference=? AND t.transaction_type IN ('transfer_in','transfer_out')":"t.id=?"} ORDER BY t.id`).bind(company,transfer?row.reference:transactionId).all()).results;
    if(row.transaction_type==='sales_return'&&row.source_id)printUrl='/sales-return-print?id='+Number(row.source_id);
   }
   return Response.json({document,lines,printUrl});
  }
  const warehouses=(await db.prepare(`SELECT w.code,w.name,w.active,COALESCE(SUM(t.quantity),0) AS quantity FROM warehouses w LEFT JOIN stock_transactions t ON t.company_code=w.company_code AND t.warehouse_code=w.code AND t.item_id=? WHERE w.company_code=? GROUP BY w.id ORDER BY w.code`).bind(itemId,company).all()).results;
  const summary=await db.prepare(`SELECT COUNT(*) AS transactionCount,MIN(CASE WHEN transaction_type='purchase' THEN NULLIF(transaction_date,'') END) AS firstPurchase,MAX(CASE WHEN transaction_type='purchase' THEN NULLIF(transaction_date,'') END) AS lastPurchase,MIN(CASE WHEN transaction_type='sale' THEN NULLIF(transaction_date,'') END) AS firstSale,MAX(CASE WHEN transaction_type='sale' THEN NULLIF(transaction_date,'') END) AS lastSale,COALESCE(SUM(CASE WHEN transaction_type='purchase' THEN quantity ELSE 0 END),0) AS purchased,COALESCE(SUM(CASE WHEN transaction_type='sale' THEN -quantity ELSE 0 END),0) AS sold,COALESCE(SUM(CASE WHEN transaction_type IN ('sales_return','credit_return') THEN quantity ELSE 0 END),0) AS returned FROM stock_transactions WHERE company_code=? AND item_id=?`).bind(company,itemId).first();
  const averages=(await db.prepare(`SELECT t.transaction_type AS kind,COALESCE(NULLIF(p.currency,''),t.currency) AS currency,SUM(ABS(t.quantity)) AS quantity,SUM(ABS(t.quantity)*CASE WHEN t.transaction_type='purchase' THEN t.unit_cost ELSE t.unit_sale_price END)/NULLIF(SUM(ABS(t.quantity)),0) AS average FROM stock_transactions t LEFT JOIN invoices p ON t.transaction_type='sale' AND p.id=t.source_id AND p.company_code=t.company_code WHERE t.company_code=? AND t.item_id=? AND ((t.transaction_type='purchase' AND t.unit_cost IS NOT NULL AND t.quantity>0) OR (t.transaction_type='sale' AND t.unit_sale_price IS NOT NULL AND t.quantity<0)) GROUP BY t.transaction_type,COALESCE(NULLIF(p.currency,''),t.currency) ORDER BY kind,currency`).bind(company,itemId).all()).results;
  const transactions=(await db.prepare(`WITH ledger AS (SELECT t.*,SUM(quantity) OVER(PARTITION BY warehouse_code ORDER BY id ROWS UNBOUNDED PRECEDING) AS balance FROM stock_transactions t WHERE company_code=? AND item_id=?) SELECT id,transaction_type AS type,reference,transaction_date AS date,warehouse_code AS warehouse,quantity,balance,notes FROM ledger ORDER BY id DESC LIMIT 51 OFFSET ?`).bind(company,itemId,(page-1)*50).all()).results;
  return Response.json({item:{id:item.id,sku:item.sku,name:item.name,brand:item.brand,salePrice:item.sale_price,vatRate:item.vat_rate,discountRate:item.discount_rate,stockQty:item.stock_qty,...decodeMaster(item)},warehouses,summary,averages,transactions:transactions.slice(0,50),hasMore:transactions.length>50});
 }catch(error){console.error(error);return Response.json({error:'Could not load the item dashboard.'},{status:500});}
}