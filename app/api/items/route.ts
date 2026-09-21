import {ensureStockLedger} from '../../../db/stock';
import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
import {getWorkshopSettings} from '../../../db/settings';
import {decodeMaster} from '../../../db/item-master';
import {defaultMaster,validateMaster,type ItemMaster} from '../../../lib/item-master';
const averageCostSql=`SELECT i.active,i.master_json,i.master_revision,i.id,i.company_code AS companyCode,i.sku,i.name,i.brand,i.sale_price AS salePrice,i.vat_rate AS vatRate,i.discount_rate AS discountRate,i.stock_qty AS stockQty,i.created_at AS createdAt,
  CASE WHEN COALESCE(cost.quantity,0)>0 THEN ROUND(cost.total / cost.quantity,4) ELSE NULL END AS averageCost
 FROM items i LEFT JOIN (
   SELECT t.company_code,t.item_id,SUM(t.quantity) AS quantity,
    SUM(t.quantity*t.unit_cost*source_currency.rate/default_currency.rate) AS total
   FROM stock_transactions t JOIN workshop_settings s ON s.company_code=t.company_code
   JOIN currencies source_currency ON source_currency.company_code=t.company_code AND source_currency.code=t.currency
   JOIN currencies default_currency ON default_currency.company_code=t.company_code AND default_currency.code=s.default_currency
   WHERE t.transaction_type='purchase' AND t.quantity>0 AND t.unit_cost IS NOT NULL
    AND source_currency.rate>0 AND default_currency.rate>0
   GROUP BY t.company_code,t.item_id
 ) cost ON cost.company_code=i.company_code AND cost.item_id=i.id`;

function present(row:Record<string,unknown>){const {master_json,master_revision,...rest}=row;return {...rest,...decodeMaster(row)}}
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{await ensureStockLedger(auth.companyCode);const rows=await getRawDb().prepare(averageCostSql+' WHERE i.company_code=? ORDER BY i.name').bind(auth.companyCode.toLowerCase()).all<Record<string,unknown>>();return Response.json({items:rows.results.map(present)})}catch(error){console.error(error);return Response.json({error:'Could not load items.'},{status:500})}}
export const POST=saveItem;export const PUT=saveItem;
async function saveItem(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{
 const body=await request.json() as Record<string,unknown>,db=getRawDb(),company=auth.companyCode.toLowerCase(),editing=request.method==='PUT',id=Number(body.id);
 const existing=editing?await db.prepare('SELECT * FROM items WHERE id=? AND company_code=?').bind(id,company).first<Record<string,unknown>>():null;
 if(editing&&!existing)return Response.json({error:'Item not found.'},{status:404});
 const previous=existing?decodeMaster(existing):defaultMaster();
 if(editing&&Number(body.masterRevision)!==previous.masterRevision)return Response.json({error:'This item changed. Reopen it before saving.'},{status:409});
 if(body.stockQty!==undefined&&Number(body.stockQty)!==Number(existing?.stock_qty??0))throw new Error('Stock is read-only. Use Adjust stock and enter a reason.');
 const name=String(body.name??'').trim(),sku=String(body.sku??'').trim().toUpperCase(),brand=String(body.brand??'').trim(),salePrice=Number(body.salePrice??0),vatRate=Number(body.vatRate??(await getWorkshopSettings(company,db)).defaultTax),discountRate=Number(body.discountRate??0);
 if(!name||!sku||name.length>200||sku.length>100||!Number.isFinite(salePrice)||salePrice<0||salePrice>1e12||!Number.isFinite(vatRate)||vatRate<0||vatRate>100||!Number.isFinite(discountRate)||discountRate<0||discountRate>100)throw new Error('Check item name, code, price, VAT and discount.');
 const master=validateMaster({...previous,...body,active:body.active===undefined?previous.active:!!body.active} as ItemMaster);
 // A saved base-unit meaning is immutable; all old quantities remain valid.
 if(existing&&master.baseUnit!==previous.baseUnit)throw new Error('The base stock unit cannot change on an existing item.');
 for(const unit of previous.units){const next=master.units.find(u=>u.code===unit.code);if(existing&&(!next||next.factor!==unit.factor))throw new Error('Existing units and factors cannot be changed or removed. Add a new unit instead.');}
 for(const [category,value,parent] of [['group',master.group,''],['subgroup',master.subgroup,master.group],['brand',brand,'']]){if(!value)continue;if((category==='brand'&&value===existing?.brand)||(category==='group'&&value===previous.group)||(category==='subgroup'&&value===previous.subgroup&&parent===previous.group))continue;if(!await db.prepare('SELECT id FROM item_master_values WHERE company_code=? AND category=? AND name=? AND parent=? AND active=1').bind(company,category,value,parent).first())throw new Error('Choose an active '+category+' from the managed lists.');}
 if(master.subgroup&&!master.group)throw new Error('Select a group before a subgroup.');
 for(const supplier of master.itemSuppliers)if(!await db.prepare('SELECT id FROM suppliers WHERE company_code=? AND id=?').bind(company,supplier.supplierId).first())throw new Error('Supplier not found in this company.');
 const json=JSON.stringify({group:master.group,subgroup:master.subgroup,baseUnit:master.baseUnit,salesUnit:master.salesUnit,purchaseUnit:master.purchaseUnit,units:master.units,barcodes:master.barcodes,itemSuppliers:master.itemSuppliers});
 const token=crypto.randomUUID(),statements:D1PreparedStatement[]=[];
 if(editing)statements.push(db.prepare('INSERT INTO item_master_guards(token,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM items WHERE id=? AND company_code=? AND master_revision=?) THEN 1 ELSE NULL END)').bind(token,id,company,previous.masterRevision),db.prepare('UPDATE items SET name=?,sku=?,brand=?,sale_price=?,vat_rate=?,discount_rate=?,active=?,master_json=?,master_revision=master_revision+1 WHERE id=? AND company_code=?').bind(name,sku,brand,salePrice,vatRate,discountRate,master.active?1:0,json,id,company),db.prepare('DELETE FROM item_barcodes WHERE item_id=? AND company_code=?').bind(id,company));
 else statements.push(db.prepare('INSERT INTO items(company_code,name,sku,brand,sale_price,vat_rate,discount_rate,active,master_json,master_revision,stock_qty) VALUES(?,?,?,?,?,?,?,?,?,1,0)').bind(company,name,sku,brand,salePrice,vatRate,discountRate,master.active?1:0,json));
 for(const b of master.barcodes)statements.push(db.prepare('INSERT INTO item_barcodes(company_code,item_id,code,unit,is_primary) SELECT ?,id,?,?,? FROM items WHERE company_code=? AND sku=?').bind(company,b.code.toLowerCase(),b.unit,b.primary?1:0,company,sku));
 if(editing)statements.push(db.prepare('DELETE FROM item_master_guards WHERE token=?').bind(token));
 await db.batch(statements);return Response.json({item:present((await db.prepare(averageCostSql+' WHERE i.company_code=? AND i.sku=?').bind(company,sku).first<Record<string,unknown>>())!)},{status:editing?200:201});
 }catch(error){const message=error instanceof Error?error.message:String(error);return Response.json({error:/UNIQUE/i.test(message)?'This item code or barcode already exists in this company.':/item_master_guards/.test(message)?'This item changed. Reopen it before saving.':message},{status:/UNIQUE|item_master_guards/.test(message)?409:400})}}
