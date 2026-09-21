import {getRawDb} from ".";
import {getWorkshopSettings} from "./settings";
type Party={id:number;kind:"customer"|"supplier";code:string|null;name:string;accountNumber:string;accountId:number|null};
type Account={id:number;code:string;active:number;name:string};
export async function accountMigration(company:string,db:D1Database=getRawDb()){
 const [customers,suppliers,accounts,settings,historical]=await Promise.all([
  db.prepare("SELECT id,'customer' AS kind,customer_code AS code,name,account_number AS accountNumber,account_id AS accountId FROM customers WHERE company_code=?").bind(company).all<Party>(),
  db.prepare("SELECT id,'supplier' AS kind,supplier_code AS code,name,account_number AS accountNumber,account_id AS accountId FROM suppliers WHERE company_code=?").bind(company).all<Party>(),
  db.prepare("SELECT id,account_number AS code,active,name FROM accounts WHERE company_code=?").bind(company).all<Account>(),getWorkshopSettings(company,db),
  db.prepare("SELECT t.account_number AS code,COUNT(*) AS count FROM accounting_transactions t WHERE t.company_code=? AND (length(t.account_number)<>10 OR t.account_number GLOB '*[^0-9]*' OR NOT EXISTS(SELECT 1 FROM accounts a WHERE a.company_code=t.company_code AND a.account_number=t.account_number)) GROUP BY t.account_number").bind(company).all<{code:string;count:number}>(),
 ]);
 const parties=[...customers.results,...suppliers.results],groups=accounts.results.filter(a=>/^[0-9]{1,5}$/.test(a.code));
 const issues:{kind:string;id?:number;name?:string;code?:string|null;reason:string}[]=[],ready:{party:Party;code:string;accountId:number|null}[]=[];
 for(const a of accounts.results){if(!/^(?:[0-9]{1,5}|[0-9]{10})$/.test(a.code))issues.push({kind:"account",id:a.id,name:a.name,code:a.code,reason:"Incompatible account code; history is preserved. Deactivate and create a valid account if this account has transactions."});else if(a.code.length===10&&!groups.some(g=>a.code.startsWith(g.code)))issues.push({kind:"account",id:a.id,name:a.name,code:a.code,reason:"No configured group prefix. Create a matching group."});}
 for(const [label,code] of [["Customer prefix",settings.customerAccountPrefix],["Supplier prefix",settings.supplierAccountPrefix]])if(!groups.some(g=>g.code===code&&g.code.length===4))issues.push({kind:"configuration",name:label,code,reason:"Create this four-digit group in Account prefix setup."});
 for(const [label,code] of [["Sales",settings.salesAccountNumber],["Sales tax",settings.taxAccountNumber],["Purchases",settings.purchaseAccountNumber],["Purchase tax",settings.purchaseTaxAccountNumber]])if(!accounts.results.some(a=>a.code===code&&a.active&&/^[0-9]{10}$/.test(a.code)))issues.push({kind:"configuration",name:label,code,reason:"Select an active 10-digit posting account in Company Configuration."});
 for(const p of parties){
  const fail=(reason:string)=>issues.push({kind:p.kind,id:p.id,name:p.name,code:p.code,reason});
  if(!/^[0-9]{6}$/.test(p.code??"")){fail("Code must contain exactly six digits. No automatic padding or renumbering was applied.");continue;}
  if(p.accountId)continue;
  const prefix=p.kind==="customer"?settings.customerAccountPrefix:settings.supplierAccountPrefix,code=p.accountNumber||prefix+p.code;
  if(!/^[0-9]{10}$/.test(code)){fail("Existing account number is incompatible; it was preserved.");continue;}
  if(parties.some(other=>(other.kind!==p.kind||other.id!==p.id)&&other.accountNumber===code)){fail("Existing account is referenced by another customer or supplier.");continue;}
  const existing=accounts.results.find(a=>a.code===code);
  if(existing&&!p.accountNumber){fail(`Generated account ${code} already exists for an unrelated record.`);continue;}
  if(existing&&!existing.active){fail(`Account ${code} is inactive.`);continue;}
  if(!groups.some(g=>code.startsWith(g.code))){fail(`No matching group for account ${code}. Create a grouping account first.`);continue;}
  if(!p.accountNumber&&!groups.some(g=>g.code===prefix)){fail(`Configure prefix group ${prefix} first.`);continue;}
  ready.push({party:p,code,accountId:existing?.id??null});
 }
 const duplicates=new Set(ready.filter(r=>ready.some(o=>o!==r&&o.code===r.code)).map(r=>r.code));
 for(const r of ready.filter(r=>duplicates.has(r.code)))issues.push({kind:r.party.kind,id:r.party.id,name:r.party.name,code:r.party.code,reason:`Multiple records would create account ${r.code}. Resolve the conflict first.`});
 const safe=ready.filter(r=>!duplicates.has(r.code));
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({parties,accounts:accounts.results,settings,safe}))))).map(n=>n.toString(16).padStart(2,"0")).join("");
 return {ready:safe,issues,historical:historical.results,fingerprint};
}
