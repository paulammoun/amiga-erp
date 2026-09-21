import {getRawDb} from './index';
export async function ensureWarehouses(company:string,db=getRawDb()){
 await db.prepare("INSERT INTO warehouses(company_code,code,name) VALUES(?,'MAIN','Main Warehouse') ON CONFLICT(company_code,code) DO NOTHING").bind(company.toLowerCase()).run();
}
export async function warehouseFor(db:D1Database,company:string,value:unknown){
 await ensureWarehouses(company,db);const code=String(value??'MAIN').trim().toUpperCase();
 const warehouse=await db.prepare('SELECT code,name,active FROM warehouses WHERE company_code=? AND code=?').bind(company,code).first<{code:string;name:string;active:number}>();
 if(!warehouse?.active)throw new Error('Select an active warehouse for this company.');return warehouse.code;
}
/** Warehouse stock is derived from the audited base-unit ledger, never company totals. */
export const warehouseBalanceSql=(item:string,company:string,warehouse:string)=>`COALESCE((SELECT SUM(ws.quantity) FROM stock_transactions ws WHERE ws.item_id=${item} AND ws.company_code=${company} AND ws.warehouse_code=${warehouse}),0)`;
export async function warehouseQuantity(db:D1Database,company:string,itemId:number,warehouse:string){
 const row=await db.prepare('SELECT COALESCE(SUM(quantity),0) AS quantity FROM stock_transactions WHERE company_code=? AND item_id=? AND warehouse_code=?').bind(company,itemId,warehouse).first<{quantity:number}>();return Number(row?.quantity??0);
}
