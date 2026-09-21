import {defaultMaster, type ItemMaster} from '../lib/item-master';
export function decodeMaster(row:Record<string,unknown>):ItemMaster{
 const base=defaultMaster(),saved=JSON.parse(String(row.master_json||'{}'));
 return {...base,...saved,active:row.active!==0,masterRevision:Number(row.master_revision||0)};
}
export async function itemUnit(db:D1Database,company:string,id:number,code:unknown,kind:'sales'|'purchase'='sales',supplierId?:number){
 const row=await db.prepare('SELECT master_json,active,master_revision FROM items WHERE company_code=? AND id=?').bind(company,id).first<Record<string,unknown>>();
 if(!row)throw new Error('Item not found.');const master=decodeMaster(row);if(!master.active)throw new Error('Inactive items cannot be used in new transactions.');
 const selected=String(code|| (kind==='purchase'?(master.itemSuppliers.find(s=>s.supplierId===supplierId)?.unit||master.purchaseUnit):master.salesUnit));
 const unit=master.units.find(u=>u.code===selected);if(!unit)throw new Error('Select a valid item unit.');return {unit:unit.code,unitFactor:unit.factor};
}
