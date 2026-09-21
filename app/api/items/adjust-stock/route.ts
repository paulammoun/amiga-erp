import {warehouseFor,warehouseQuantity,warehouseBalanceSql} from '../../../../db/warehouses';
import {getRawDb} from '../../../../db';
import {requireUser} from '../../../../db/auth';
import {decodeMaster} from '../../../../db/item-master';
import {ensureStockLedger} from '../../../../db/stock';
import {stockQuantity} from '../../../../lib/item-master';
export async function POST(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{
 const b=await request.json() as Record<string,unknown>,db=getRawDb(),company=auth.companyCode.toLowerCase(),id=Number(b.itemId),reason=String(b.reason??'').trim(),quantity=Number(b.quantity),expected=Number(b.expectedStock),key=String(b.requestKey??'');
 if(reason.length<3||reason.length>1000||!Number.isFinite(quantity)||quantity===0||!Number.isFinite(expected)||!key||key.length>100)throw new Error('Enter a nonzero adjustment and a reason (3–1000 characters).');
 await ensureStockLedger(company,db);
 const item=await db.prepare('SELECT * FROM items WHERE id=? AND company_code=?').bind(id,company).first<Record<string,unknown>>();if(!item)throw new Error('Item not found.');const master=decodeMaster(item),unit=master.units.find(u=>u.code===b.unit);if(!unit)throw new Error('Select a valid unit.');const delta=stockQuantity(quantity,unit.factor);stockQuantity(expected+delta,1);
 const warehouseCode=await warehouseFor(db,company,b.warehouseCode);
 const token='adjust:'+company+':'+key;
 await db.batch([
 db.prepare(`INSERT INTO item_master_guards(token,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM items WHERE id=? AND company_code=? AND ${warehouseBalanceSql('items.id','items.company_code','?')}=? AND master_revision=?) THEN 1 ELSE NULL END)`).bind(token,id,company,warehouseCode,expected,master.masterRevision),
 db.prepare("INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity,notes,warehouse_code) VALUES(?,?,'adjustment',?,date('now'),?,?,?)").bind(company,id,'ADJ-'+key,delta,reason+' · '+auth.username+' · '+quantity+' '+unit.code+' × '+unit.factor,warehouseCode),
 db.prepare('UPDATE items SET stock_qty=stock_qty+? WHERE id=? AND company_code=?').bind(delta,id,company)]);
 const updated=await db.prepare('SELECT stock_qty AS stockQty FROM items WHERE id=? AND company_code=?').bind(id,company).first<{stockQty:number}>();return Response.json({stockQty:updated!.stockQty,warehouseQty:await warehouseQuantity(db,company,id,warehouseCode)});
 }catch(e){return Response.json({error:/constraint/i.test(String(e))?'Stock changed or this adjustment was already applied. Refresh before continuing.':(e as Error).message},{status:409})}}
