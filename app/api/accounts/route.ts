import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {getCurrency} from "../../../db/currencies";
import {accountAssertion} from "../../../db/coa-write";
const columns="id,account_number AS accountNumber,name,account_type AS accountType,currency,active,managed,notes,created_at AS createdAt";
type Account={id:number;accountNumber:string;name:string;accountType:string;currency:string;active:number;managed:number;notes:string};
export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const db=getRawDb(),company=auth.companyCode.toLowerCase();
  const rows=(await db.prepare(`SELECT ${columns} FROM accounts WHERE company_code=? ORDER BY account_number`).bind(company).all<Account>()).results;
  const balances=(await db.prepare("SELECT account_number AS code,SUM(CASE WHEN indicator='debit' THEN amount_local_currency ELSE -amount_local_currency END) AS balance FROM accounting_transactions WHERE company_code=? GROUP BY account_number").bind(company).all<{code:string;balance:number}>()).results;
  const groups=rows.filter(a=>/^[0-9]{1,5}$/.test(a.accountNumber));
  const accounts=rows.map(a=>{
   const ancestors=groups.filter(g=>g.accountNumber.length<a.accountNumber.length&&a.accountNumber.startsWith(g.accountNumber)).sort((x,y)=>y.accountNumber.length-x.accountNumber.length);
   const kind=/^[0-9]{10}$/.test(a.accountNumber)?"posting":/^[0-9]{1,5}$/.test(a.accountNumber)?"group":"legacy";
   const balance=balances.filter(b=>kind==="group"?/^[0-9]{10}$/.test(b.code)&&rows.some(p=>p.accountNumber===b.code)&&b.code.startsWith(a.accountNumber):b.code===a.accountNumber).reduce((v,b)=>v+Number(b.balance),0);
   return {...a,kind,parentId:ancestors[0]?.id??null,depth:ancestors.length,balance};
  });
  return Response.json({accounts:new URL(request.url).searchParams.has("posting")?accounts.filter(a=>a.kind==="posting"&&a.active):accounts});
 }catch(error){console.error(error);return Response.json({error:"Could not load accounts."},{status:503})}
}
async function save(request:Request,update:boolean){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
  const b=await request.json() as Record<string,unknown>,db=getRawDb(),company=auth.companyCode.toLowerCase();
  const number=String(b.accountNumber??""),name=String(b.name??"").trim(),type=String(b.accountType??"other"),currency=String(b.currency??"USD"),notes=String(b.notes??"").trim(),id=Number(b.id),active=b.active===true||b.active===1?1:0;
  const current=update?await db.prepare("SELECT account_number AS code FROM accounts WHERE id=? AND company_code=?").bind(id,company).first<{code:string}>():null;
  if(number!==current?.code&&!/^(?:[0-9]{1,5}|[0-9]{10})$/.test(number))throw new Error("Use 1–5 digits for a group or exactly 10 digits for a posting account. Leading zeros are preserved.");
  if(!name||name.length>200||notes.length>2000)throw new Error("Enter a name of up to 200 characters and notes of up to 2,000 characters.");
  if(!["asset","liability","equity","income","expense","other"].includes(type))throw new Error("Select an account type.");
  const cur=await getCurrency(company,currency,db);if(!cur?.active)throw new Error("Select an active currency.");
  const old=update?await db.prepare(`SELECT ${columns} FROM accounts WHERE id=? AND company_code=?`).bind(id,company).first<Account>():null;
  if(update&&!old)return Response.json({error:"Account not found."},{status:404});
  if(old?.managed&&name!==old.name)throw new Error("Rename an automatically managed account through its customer or supplier.");
  const renumber=!!old&&number!==old.accountNumber;
  const unreferenced=`NOT EXISTS(SELECT 1 FROM accounting_transactions WHERE company_code=? AND (account_id=? OR account_number=?)) AND NOT EXISTS(SELECT 1 FROM customers WHERE company_code=? AND (account_id=? OR account_number=?)) AND NOT EXISTS(SELECT 1 FROM suppliers WHERE company_code=? AND (account_id=? OR account_number=?)) AND NOT EXISTS(SELECT 1 FROM accounts WHERE company_code=? AND id<>? AND substr(account_number,1,length(?))=?) AND NOT EXISTS(SELECT 1 FROM workshop_settings WHERE company_code=? AND ? IN(customer_account_prefix,supplier_account_prefix,sales_account_number,tax_account_number,purchase_account_number,purchase_tax_account_number))`;
  const refArgs=old?[company,id,old.accountNumber,company,id,old.accountNumber,company,id,old.accountNumber,company,id,old.accountNumber,old.accountNumber,company,old.accountNumber]:[];
  if(renumber&&!await db.prepare(`SELECT 1 AS valid WHERE ${unreferenced}`).bind(...refArgs).first())throw new Error("Accounts referenced by transactions, parties, groups or configuration cannot be renumbered. Deactivate the account to preserve history.");
  const conditions:string[]=[],args:unknown[]=[];
  if(number.length===10&&(!old||renumber)){conditions.push("EXISTS(SELECT 1 FROM accounts WHERE company_code=? AND length(account_number) BETWEEN 1 AND 5 AND account_number NOT GLOB '*[^0-9]*' AND substr(?,1,length(account_number))=account_number)");args.push(company,number)}
  if(renumber){conditions.push(unreferenced);args.push(...refArgs)}
  if(old){conditions.push('EXISTS(SELECT 1 FROM accounts WHERE id=? AND company_code=? AND account_number=? AND name=? AND managed=?)');args.push(id,company,old.accountNumber,old.name,old.managed)}
  const guard=accountAssertion(db,conditions.join(' AND ')||'1',args);
  const write=update?db.prepare(`UPDATE accounts SET account_number=?,name=?,account_type=?,currency=?,active=?,notes=? WHERE id=? AND company_code=? RETURNING ${columns}`).bind(number,name,type,currency,active,notes,id,company):db.prepare(`INSERT INTO accounts(company_code,account_number,name,account_type,currency,active,notes) VALUES(?,?,?,?,?,?,?) RETURNING ${columns}`).bind(company,number,name,type,currency,active,notes);
  const result=(await db.batch([guard.check,write,guard.clear]))[1].results[0];
  return Response.json({account:result},{status:update?200:201});
 }catch(e){const message=e instanceof Error?e.message:String(e);return Response.json({error:/UNIQUE/.test(message)?"This account code already exists in this company.":message},{status:400})}
}
export const POST=(r:Request)=>save(r,false);
export const PUT=(r:Request)=>save(r,true);
