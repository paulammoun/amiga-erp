import {customerMasterCategories} from "../lib/customer-master-catalog";

export async function ensureCustomerMasterValues(companyCode:string,db:D1Database){
 const existing=await db.prepare("SELECT COUNT(*) AS count FROM customer_master_values WHERE company_code=?").bind(companyCode).first<{count:number}>();
 if(!Number(existing?.count??0)){
  const statements=customerMasterCategories.flatMap(category=>category.defaults.map((value,index)=>db.prepare("INSERT OR IGNORE INTO customer_master_values(company_code,category,value_code,name,active,sort_order) VALUES(?,?,?,?,1,?)").bind(companyCode,category.key,value[0],value[1],index+1)));
  if(statements.length)await db.batch(statements);
 }
}
