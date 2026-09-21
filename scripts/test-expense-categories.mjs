import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
console.error=(...args)=>{if(args[0] instanceof Error)process.stderr.write(args[0].message+'\n')};
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
sql.exec(`INSERT INTO workshop_settings(company_code,company_name,default_tax,sales_account_number,tax_account_number,default_currency,local_currency,negative_stock_policy) VALUES('test','Test',11,'4000','2200','USD','USD','block');
INSERT INTO currencies(company_code,code,name,rate,active) VALUES('test','USD','Dollar',1,1);
INSERT INTO customers(id,company_code,customer_code,name,account_number,allow_credit_sales,status,vat_treatment,payment_terms) VALUES(1,'test','C1','Customer','1100',1,'active','standard','cash');
INSERT INTO accounts(company_code,account_number,name,account_type,currency,active) VALUES('test','1100','Receivable','asset','USD',1),('test','1000','Cash','asset','USD',1),('test','4000','Sales','income','USD',1),('test','2200','VAT','liability','USD',1);
INSERT INTO items(id,company_code,sku,name,sale_price,vat_rate,stock_qty) VALUES(1,'test','P1','Part',100,11,1000);
INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('test',1,'opening','Opening','2026-09-18',1000);`);
globalThis.orderDb={prepare(text){return{sql:text,args:[],bind(...args){return{...this,args}},async first(){return sql.prepare(this.sql).get(...this.args)??null},async all(){return{results:sql.prepare(this.sql).all(...this.args)}},async run(){return{...sql.prepare(this.sql).run(...this.args),success:true}}}},async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>({...sql.prepare(s.sql).run(...s.args),success:true}));sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const toUrl=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const overrides={
 'db/index.ts':'export const getRawDb=()=>globalThis.orderDb;',
 'db/auth.ts':`export const requireUser=async request=>request.headers.get('company')==='unauthorized'?new Response('{}',{status:401}):({id:1,username:'tester',role:'user',companyCode:request.headers.get('company')||'test'});`,
 'db/settings.ts':`export const getWorkshopSettings=async()=>({defaultTax:11,defaultCurrency:'USD',localCurrency:'USD',localCurrencyRate:1,companyName:'Test',companyAddress:'',sellerTaxRegistration:'',logoDataUrl:'',negativeStockPolicy:'block'});`,
 'db/invoice-history.ts':'export const ensureHistoricalInvoiceValues=async()=>{};',
 'db/currencies.ts':`export const ensureCompanyCurrencies=async()=>{};export const getCurrency=async(company,code)=>globalThis.orderDb.prepare('SELECT * FROM currencies WHERE company_code=? AND code=?').bind(company,code).first();`
};
const cache=new Map();function moduleUrl(file){file=file.replaceAll('\\','/');if(cache.has(file))return cache.get(file);let source=overrides[file]??readFileSync(file,'utf8');source=source.replace(/from\s*(['"])(\.[^'"]*)\1/g,(match,quote,name)=>{let resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));if(!resolved.endsWith('.ts'))resolved=existsSync(resolved+'.ts')?resolved+'.ts':resolved+'/index.ts';return 'from '+JSON.stringify(moduleUrl(resolved))});const result=toUrl(source);cache.set(file,result);return result}
async function call(api,method,body,query='',company='test'){const old=console.error;console.error=()=>{};try{const r=await api[method](new Request('http://test/api'+query,{method,headers:{company,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return{status:r.status,...await r.json()}}finally{console.error=old}}
const ok=r=>{assert.ok(r.status<300,JSON.stringify(r));return r};


const api=await import(moduleUrl('app/api/expense-categories/route.ts'));
let created=ok(await call(api,'POST',{name:'  Freight  '})).category;
assert.equal(created.name,'Freight');assert.equal(created.active,1);
assert.equal((await call(api,'POST',{name:'Freight'})).status,409);
assert.equal((await call(api,'POST',{name:' '})).status,400);
assert.equal((await call(api,'POST',{name:'x'.repeat(101)})).status,400);
assert.equal((await call(api,'GET',null,'','other')).categories.length,0);
assert.equal((await call(api,'PUT',{...created,name:'Foreign'},'','other')).status,404);
ok(await call(api,'PUT',{...created,active:false}));let rows=ok(await call(api,'GET')).categories;assert.equal(rows[0].active,0);
ok(await call(api,'PUT',{...created,name:'Shipping',active:false}));rows=ok(await call(api,'GET')).categories;assert.equal(rows[0].name,'Shipping');assert.equal(rows[0].active,0);
ok(await call(api,'PUT',{...created,name:'Shipping',active:true}));assert.equal(ok(await call(api,'GET')).categories[0].active,1);
assert.equal((await call(api,'POST',{name:'Denied'},'','unauthorized')).status,401);
console.log('PASS expense category master: create, trim, duplicate/blank validation, edit, deactivate/reactivate and company isolation.');
