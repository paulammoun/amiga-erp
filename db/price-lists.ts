import { getRawDb } from "./index";

export async function ensureDefaultPriceList(companyCode:string,db:D1Database=getRawDb()){
 const company=companyCode.toLowerCase();
 await db.prepare(`INSERT INTO price_lists(company_code,code,name,active,notes)
  VALUES(?,'DEFAULT','Default price list',1,'Uses the standard item price unless an override is added.')
  ON CONFLICT(company_code,code) DO NOTHING`).bind(company).run();
 const row=await db.prepare("SELECT id FROM price_lists WHERE company_code=? AND code='DEFAULT'").bind(company).first<{id:number}>();
 if(!row)throw new Error("Could not prepare the default price list.");
 return row.id;
}
