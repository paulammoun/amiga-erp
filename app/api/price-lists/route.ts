import { getRawDb } from "../../../db";
import { requireUser } from "../../../db/auth";
import { ensureDefaultPriceList } from "../../../db/price-lists";

type LineInput={itemId?:number;price?:number};

function values(body:Record<string,unknown>){
 const code=String(body.code??"").trim().toUpperCase(),name=String(body.name??"").trim(),notes=String(body.notes??"").trim(),active=body.active!==false;
 const lines=(Array.isArray(body.items)?body.items:[]).map(value=>{const line=value as LineInput;return{itemId:Number(line.itemId),price:Number(line.price)}});
 if(!code||!name)throw new Error("Enter a price list code and name.");
 if(code.length>40||!/^[A-Z0-9][A-Z0-9._-]*$/.test(code))throw new Error("Price list code can use letters, numbers, dots, dashes and underscores.");
 if(name.length>200||notes.length>2000)throw new Error("Price list details are too long.");
 if(!lines.length&&code!=="DEFAULT")throw new Error("Add at least one item to the price list.");
 if(lines.length>500)throw new Error("A price list can contain up to 500 items.");
 if(lines.some(line=>!Number.isSafeInteger(line.itemId)||line.itemId<1||!Number.isFinite(line.price)||line.price<0||line.price>1e12))throw new Error("Check the selected items and their prices.");
 if(new Set(lines.map(line=>line.itemId)).size!==lines.length)throw new Error("Each item can appear only once in a price list.");
 return{code,name,notes,active,lines};
}

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const db=getRawDb(),company=auth.companyCode.toLowerCase();await ensureDefaultPriceList(company,db);
  await db.prepare("UPDATE customers SET price_list_id=(SELECT id FROM price_lists WHERE company_code=? AND code='DEFAULT') WHERE company_code=? AND price_list_id IS NULL").bind(company,company).run();
  const lists=await db.prepare(`SELECT p.id,p.code,p.name,p.active,p.notes,p.created_at AS createdAt,
   (SELECT COUNT(*) FROM price_list_items li WHERE li.price_list_id=p.id) AS itemCount,
   (SELECT COUNT(*) FROM customers c WHERE c.price_list_id=p.id AND c.company_code=p.company_code) AS customerCount
   FROM price_lists p WHERE p.company_code=? ORDER BY p.active DESC,p.name COLLATE NOCASE`).bind(company).all();
  const lines=await db.prepare(`SELECT li.price_list_id AS priceListId,li.item_id AS itemId,li.price,
   i.sku AS itemCode,i.name AS itemName,i.sale_price AS defaultPrice
   FROM price_list_items li JOIN price_lists p ON p.id=li.price_list_id
   JOIN items i ON i.id=li.item_id AND i.company_code=p.company_code
   WHERE p.company_code=? ORDER BY p.name COLLATE NOCASE,i.name COLLATE NOCASE`).bind(company).all();
  return Response.json({priceLists:lists.results.map(list=>({...list,active:Boolean(list.active),itemCount:Number(list.itemCount),customerCount:Number(list.customerCount),items:lines.results.filter(line=>line.priceListId===list.id)}))});
 }catch(error){console.error(error);return Response.json({error:"Could not load price lists."},{status:500})}
}

async function write(request:Request,update:boolean){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 let body:Record<string,unknown>,value:ReturnType<typeof values>;
 try{body=await request.json();value=values(body)}catch(error){return Response.json({error:error instanceof Error?error.message:"Invalid price list."},{status:400})}
 const id=Number(body.id);if(update&&(!Number.isSafeInteger(id)||id<1))return Response.json({error:"Invalid price list."},{status:400});
 try{
  const db=getRawDb(),company=auth.companyCode.toLowerCase();await ensureDefaultPriceList(company,db);
  const existing=update?await db.prepare("SELECT id,code FROM price_lists WHERE id=? AND company_code=?").bind(id,company).first<{id:number;code:string}>():null;
  if(update&&!existing)return Response.json({error:"Price list not found."},{status:404});
  if(existing?.code==="DEFAULT"&&value.code!=="DEFAULT")return Response.json({error:"The default price list code cannot be changed."},{status:400});
  if(existing?.code==="DEFAULT"&&!value.active)return Response.json({error:"The default price list must remain active."},{status:400});
  for(const line of value.lines)if(!await db.prepare("SELECT id FROM items WHERE id=? AND company_code=?").bind(line.itemId,company).first())return Response.json({error:"A selected item no longer exists."},{status:400});
  const duplicate=await db.prepare("SELECT id FROM price_lists WHERE company_code=? AND code=? AND id!=?").bind(company,value.code,update?id:0).first();
  if(duplicate)return Response.json({error:"This price list code already exists."},{status:409});
  const statements=update?[
   db.prepare("UPDATE price_lists SET code=?,name=?,active=?,notes=? WHERE id=? AND company_code=?").bind(value.code,value.name,value.active?1:0,value.notes,id,company),
   db.prepare("DELETE FROM price_list_items WHERE price_list_id=?").bind(id),
   ...value.lines.map(line=>db.prepare("INSERT INTO price_list_items(price_list_id,item_id,price) VALUES(?,?,?)").bind(id,line.itemId,line.price)),
  ]:[
   db.prepare("INSERT INTO price_lists(company_code,code,name,active,notes) VALUES(?,?,?,?,?)").bind(company,value.code,value.name,value.active?1:0,value.notes),
   ...value.lines.map(line=>db.prepare("INSERT INTO price_list_items(price_list_id,item_id,price) VALUES((SELECT id FROM price_lists WHERE company_code=? AND code=?),?,?)").bind(company,value.code,line.itemId,line.price)),
  ];
  const results=await db.batch(statements);if(results.some(result=>!result.success))throw new Error("Could not save price list.");
  const priceList=await db.prepare("SELECT id,code,name,active,notes FROM price_lists WHERE company_code=? AND code=?").bind(company,value.code).first();
  return Response.json({priceList},{status:update?200:201});
 }catch(error){console.error(error);const message=error instanceof Error?error.message:"Could not save price list.";return Response.json({error:/UNIQUE/i.test(message)?"This price list code or item is duplicated.":message},{status:/UNIQUE/i.test(message)?409:500})}
}

export const POST=(request:Request)=>write(request,false);
export const PUT=(request:Request)=>write(request,true);
