import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
import {ensureStockLedger} from '../../../db/stock';
import {warehouseFor,warehouseBalanceSql} from '../../../db/warehouses';
import {decodeMaster} from '../../../db/item-master';
import {stockQuantity} from '../../../lib/item-master';
export async function POST(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{
 const db=getRawDb(),company=auth.companyCode.toLowerCase(),b=await request.json() as Record<string,unknown>;await ensureStockLedger(company,db);
 const from=await warehouseFor(db,company,b.fromWarehouse),to=await warehouseFor(db,company,b.toWarehouse),itemId=Number(b.itemId),reason=String(b.reason??'').trim(),key=String(b.requestKey??'');
 if(from===to||reason.length<3||reason.length>1000||!key||key.length>100)throw new Error('Select different warehouses and enter a reason.');
 const item=await db.prepare('SELECT * FROM items WHERE id=? AND company_code=?').bind(itemId,company).first<Record<string,unknown>>();if(!item)throw new Error('Item not found.');const master=decodeMaster(item),unit=master.units.find(u=>u.code===b.unit);if(!master.active||!unit)throw new Error('Select an active item and valid unit.');const qty=stockQuantity(Number(b.quantity),unit.factor);if(qty<=0)throw new Error('Enter a positive transfer quantity.');
 const token='transfer:'+company+':'+key,reference='TRF-'+key;
 await db.batch([
 db.prepare(`INSERT INTO item_master_guards(token,valid) VALUES(?,CASE WHEN ${warehouseBalanceSql('?','?','?')}+0.000000001>=? AND (SELECT COUNT(*) FROM warehouses WHERE company_code=? AND code IN (?,?) AND active=1)=2 THEN 1 ELSE NULL END)`).bind(token,itemId,company,from,qty,company,from,to),
 ...[{code:from,quantity:-qty,type:'transfer_out'},{code:to,quantity:qty,type:'transfer_in'}].map(leg=>db.prepare("INSERT INTO stock_transactions(company_code,item_id,warehouse_code,transaction_type,reference,transaction_date,quantity,notes) VALUES(?,?,?,?,?,date('now'),?,?)").bind(company,itemId,leg.code,leg.type,reference,leg.quantity,reason+' · '+from+' → '+to+' · '+auth.username+' · '+b.quantity+' '+unit.code))
 ]);return Response.json({ok:true,reference},{status:201});
 }catch(e){return Response.json({error:/constraint/i.test(String(e))?'Insufficient warehouse stock, inactive warehouse, or this transfer was already applied. Refresh before continuing.':(e as Error).message},{status:409})}}
