import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {values} from "../../../db/sales-hierarchy";
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;const db=getRawDb(),company=auth.companyCode.toLowerCase();const [a,s]=await Promise.all([db.prepare("SELECT * FROM area_managers WHERE company_code=? ORDER BY name COLLATE NOCASE").bind(company).all(),db.prepare("SELECT *,area_manager_id AS areaManagerId FROM sales_supervisors WHERE company_code=? ORDER BY name COLLATE NOCASE").bind(company).all()]);return Response.json({areaManagers:a.results,supervisors:s.results});}
async function save(request:Request,editing:boolean){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{
 const body=await request.json() as Record<string,unknown>,kind=body.kind;
 if(kind!=="area-manager"&&kind!=="supervisor")throw new Error("Invalid hierarchy level.");
 const table=kind==="area-manager"?"area_managers":"sales_supervisors",v=values(body),db=getRawDb(),company=auth.companyCode.toLowerCase(),id=Number(body.id);
 const current=editing?await db.prepare(`SELECT * FROM ${table} WHERE id=? AND company_code=?`).bind(id,company).first<{area_manager_id?:number}>():null;
 if(editing&&!current)return Response.json({error:"Record not found."},{status:404});
 const parent=Number(body.areaManagerId);
 if(kind==="supervisor"){
 if(!Number.isSafeInteger(parent)||parent<1)throw new Error("Select an area manager.");
 const manager=await db.prepare("SELECT id FROM area_managers WHERE id=? AND company_code=? AND (active=1 OR id=?)").bind(parent,company,current?.area_manager_id??0).first();if(!manager)throw new Error("Select an active area manager from this company.");
 }
 const columns=kind==="supervisor"?",area_manager_id":"",args: (string|number)[]=[v.code,v.name,v.phone,v.email,v.notes,v.active?1:0];if(kind==="supervisor")args.push(parent);
 const row=editing?await db.prepare(`UPDATE ${table} SET code=?,name=?,phone=?,email=?,notes=?,active=?${kind==="supervisor"?",area_manager_id=?":""} WHERE id=? AND company_code=? RETURNING *`).bind(...args,id,company).first():await db.prepare(`INSERT INTO ${table}(code,name,phone,email,notes,active${columns},company_code) VALUES(?,?,?,?,?,?${kind==="supervisor"?",?":""},?) RETURNING *`).bind(...args,company).first();
 return Response.json({record:row},{status:editing?200:201});
 }catch(e){const message=e instanceof Error?e.message:"Could not save hierarchy.";return Response.json({error:/UNIQUE/i.test(message)?"This code already exists.":message.replaceAll("salesman","representative").replaceAll("Salesman","Representative")},{status:400});}}
export const POST=(request:Request)=>save(request,false);
export const PUT=(request:Request)=>save(request,true);
