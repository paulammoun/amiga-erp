import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {accountMigration} from "../../../db/account-migration";
import {accountAssertion} from "../../../db/coa-write";
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{return Response.json(await accountMigration(auth.companyCode.toLowerCase()))}catch(e){console.error(e);return Response.json({error:"Could not inspect account migration."},{status:503})}}
export async function POST(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const company=auth.companyCode.toLowerCase(),db=getRawDb(),body=await request.json() as {fingerprint:string},report=await accountMigration(company,db);
  if(body.fingerprint!==report.fingerprint)return Response.json({error:"Records changed since review. Refresh the report before applying."},{status:409});
  const statements:D1PreparedStatement[]=[];
  for(const r of report.ready){
   const table=r.party.kind==="customer"?"customers":"suppliers",column=r.party.kind==="customer"?"customer_code":"supplier_code";
   const guard=`id=? AND company_code=? AND ${column}=? AND name=? AND account_number=? AND account_id IS NULL`,args=[r.party.id,company,r.party.code,r.party.name,r.party.accountNumber];
   const check=accountAssertion(db,`EXISTS(SELECT 1 FROM ${table} WHERE ${guard}) AND EXISTS(SELECT 1 FROM accounts g WHERE g.company_code=? AND length(g.account_number) BETWEEN 1 AND 5 AND g.account_number NOT GLOB '*[^0-9]*' AND substr(?,1,length(g.account_number))=g.account_number) AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.company_code=? AND c.account_number=? ${table==='customers'?'AND c.id<>?':''}) AND NOT EXISTS(SELECT 1 FROM suppliers c WHERE c.company_code=? AND c.account_number=? ${table==='suppliers'?'AND c.id<>?':''}) AND NOT EXISTS(SELECT 1 FROM accounts a WHERE a.company_code=? AND a.account_number=? AND a.active<>1)`,[...args,company,r.code,company,r.code,...(table==='customers'?[r.party.id]:[]),company,r.code,...(table==='suppliers'?[r.party.id]:[]),company,r.code]);
   statements.push(check.check);
   const prefixCheck=!r.party.accountNumber?accountAssertion(db,`COALESCE((SELECT ${r.party.kind}_account_prefix FROM workshop_settings WHERE company_code=?),?)=?`,[company,r.party.kind==='customer'?'4111':'4011',r.code.slice(0,4)]):null;
   if(prefixCheck)statements.push(prefixCheck.check);
   if(!r.accountId)statements.push(db.prepare(`INSERT INTO accounts(company_code,account_number,name,account_type,currency,active,managed) SELECT company_code,?,name,?,COALESCE((SELECT default_currency FROM workshop_settings WHERE company_code=?),'USD'),1,1 FROM ${table} WHERE ${guard}`).bind(r.code,r.party.kind==="customer"?"asset":"liability",company,...args));
   statements.push(db.prepare(`UPDATE ${table} SET account_id=(SELECT id FROM accounts WHERE company_code=? AND account_number=?),account_number=? WHERE ${guard} AND EXISTS(SELECT 1 FROM accounts a WHERE a.company_code=${table}.company_code AND a.account_number=?)`).bind(company,r.code,r.code,...args,r.code));
   statements.push(db.prepare(`UPDATE accounts SET managed=1,name=(SELECT name FROM ${table} WHERE id=? AND company_code=?) WHERE id=(SELECT account_id FROM ${table} WHERE id=? AND company_code=?)`).bind(r.party.id,company,r.party.id,company));
   statements.push(check.clear);
   if(prefixCheck)statements.push(prefixCheck.clear);
  }
  if(statements.length)await db.batch(statements);
  return Response.json({report:await accountMigration(company,db),message:"Eligible links applied. Existing account numbers and historical entries were preserved."});
 }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400})}
}

