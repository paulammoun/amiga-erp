import { ensureStockLedger } from "../../../db/stock";
import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 const params=new URL(request.url).searchParams;
 const warehouseCode=params.get('warehouseCode')??'';
 const itemId=Number(params.get("itemId")||0),page=Number(params.get("page")||1),query=(params.get("q")||"").trim();
 if(!Number.isSafeInteger(itemId)||itemId<0||!Number.isSafeInteger(page)||page<1||page>100000)return Response.json({error:"Invalid filters."},{status:400});
 try{
  await ensureStockLedger(auth.companyCode);
  const company=auth.companyCode.toLowerCase(),db=getRawDb();
  // Compute balances over the complete item history before filtering or paging.
  const result=await db.prepare(`WITH ledger AS (
   SELECT t.*,i.sku,i.name AS itemName,COALESCE(json_extract(i.master_json,'$.baseUnit'),'unit') AS baseUnit,SUM(t.quantity) OVER(PARTITION BY t.item_id,t.warehouse_code ORDER BY t.id ROWS UNBOUNDED PRECEDING) AS balance
   FROM stock_transactions t JOIN items i ON i.id=t.item_id AND i.company_code=t.company_code WHERE t.company_code=?
  ) SELECT warehouse_code AS warehouseCode,(SELECT name FROM warehouses w WHERE w.company_code=ledger.company_code AND w.code=ledger.warehouse_code) AS warehouseName,id,item_id AS itemId,sku,itemName,baseUnit,transaction_type AS transactionType,reference,transaction_date AS transactionDate,quantity,unit_cost AS unitCost,unit_sale_price AS unitSalePrice,currency,quantity*unit_cost AS costAmount,balance,notes,created_at AS createdAt
  FROM ledger WHERE (?='' OR warehouse_code=?) AND (?=0 OR item_id=?) AND (?='' OR instr(lower(sku||' '||itemName||' '||reference||' '||transaction_type),lower(?))>0)
  ORDER BY id DESC LIMIT 51 OFFSET ?`).bind(company,warehouseCode,warehouseCode,itemId,itemId,query,query,(page-1)*50).all();
  return Response.json({transactions:result.results.slice(0,50),hasMore:result.results.length>50});
 }catch(error){console.error(error);return Response.json({error:"Could not load stock transactions."},{status:500});}
}
