import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {ensureCustomerMasterValues} from "../../../db/customer-master-values";
import {customerMasterCategory,customerMasterCategoryKeys} from "../../../lib/customer-master-catalog";

const columns="id,category,value_code AS code,name,active,sort_order AS sortOrder";
const codePattern=/^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function values(body:Record<string,unknown>,update=false){
 const id=Number(body.id),category=String(body.category??"").trim(),name=String(body.name??"").trim(),sortOrder=Math.max(0,Math.trunc(Number(body.sortOrder)||0));
 let code=String(body.code??"").trim();
 if(update&&(!Number.isSafeInteger(id)||id<1))throw new Error("Invalid list value");
 if(!customerMasterCategoryKeys.has(category))throw new Error("Select a valid list");
 if(!name||name.length>100)throw new Error("Name is required and must be 100 characters or fewer");
 if(!update){
  if(!code||code.length>50||!codePattern.test(code))throw new Error("Code must use letters, numbers, dots, dashes, or underscores");
 }
 return {id,category,code,name,sortOrder,active:body.active!==false};
}

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{const db=getRawDb(),company=auth.companyCode.toLowerCase();await ensureCustomerMasterValues(company,db);const rows=await db.prepare(`SELECT ${columns} FROM customer_master_values WHERE company_code=? AND category<>'currency' ORDER BY category,sort_order,name COLLATE NOCASE`).bind(company).all();return Response.json({customerMasterValues:rows.results})}
 catch(error){console.error(error);return Response.json({error:"Could not load customer lists."},{status:503})}
}

export async function POST(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{const body=await request.json() as Record<string,unknown>,value=values(body),db=getRawDb(),company=auth.companyCode.toLowerCase();await ensureCustomerMasterValues(company,db);const created=await db.prepare(`INSERT INTO customer_master_values(company_code,category,value_code,name,active,sort_order) VALUES(?,?,?,?,?,?) RETURNING ${columns}`).bind(company,value.category,value.code,value.name,value.active?1:0,value.sortOrder).first();return Response.json({value:created},{status:201})}
 catch(error){const message=error instanceof Error?error.message:"Could not add list value";return Response.json({error:/UNIQUE/i.test(message)?"This code already exists in the selected list.":message},{status:/UNIQUE/i.test(message)?409:400})}
}

export async function PUT(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{const body=await request.json() as Record<string,unknown>,value=values(body,true),db=getRawDb(),company=auth.companyCode.toLowerCase();const existing=await db.prepare("SELECT category FROM customer_master_values WHERE id=? AND company_code=?").bind(value.id,company).first<{category:string}>();if(!existing)return Response.json({error:"List value not found"},{status:404});if(existing.category!==value.category||!customerMasterCategory(value.category))return Response.json({error:"List category cannot be changed"},{status:400});const updated=await db.prepare(`UPDATE customer_master_values SET name=?,active=?,sort_order=? WHERE id=? AND company_code=? RETURNING ${columns}`).bind(value.name,value.active?1:0,value.sortOrder,value.id,company).first();return Response.json({value:updated})}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Could not update list value"},{status:400})}
}
