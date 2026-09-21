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


const api=await import(moduleUrl('app/api/purchases/route.ts'));
sql.exec("INSERT INTO suppliers(id,company_code,name,account_number) VALUES(1,'test','Supplier','2100'); INSERT INTO currencies(company_code,code,name,rate,active) VALUES('test','LBP','Lebanese pound',1.0/89500,1),('test','EUR','Euro',1.2,1);");
const body={supplierId:1,purchaseDate:'2026-09-19',currency:'USD',taxRate:11,lines:[{itemId:1,description:'Part',unit:'unit',quantity:2,unitCost:50}],expenses:[],taxOverride:7.25};
let p=ok(await call(api,'POST',body)).purchase;assert.equal(p.tax,7.25);assert.equal(p.total,107.25);assert.equal(p.totalLbp,9598875);assert.equal(p.lbpRate,89500);
let saved=ok(await call(api,'GET',null,'?id='+p.id));assert.equal(saved.purchase.taxOverride,7.25);assert.equal(saved.purchase.totalLbp,9598875);assert.equal(saved.lines[0].landedUnitCost,50);
assert.equal(sql.prepare("SELECT amount_currency a FROM accounting_transactions WHERE reference=? AND notes='Purchase tax'").get(p.purchaseNumber).a,7.25);
sql.exec("UPDATE currencies SET rate=1.0/90000 WHERE code='LBP';");
p=ok(await call(api,'PUT',{...body,id:p.id,lines:[{...body.lines[0],quantity:4}]})).purchase;assert.equal(p.total,207.25);assert.equal(p.totalLbp,18548875);
const {taxOverride,...withoutOverride}=body;p=ok(await call(api,'PUT',{...withoutOverride,id:p.id})).purchase;assert.equal(p.tax,7.25);
p=ok(await call(api,'PUT',{...body,id:p.id,taxOverride:0})).purchase;assert.equal(p.tax,0);assert.equal(p.total,100);
p=ok(await call(api,'PUT',{...body,id:p.id,taxOverride:null})).purchase;assert.equal(p.tax,11);assert.equal(p.total,111);assert.equal(p.taxOverride,null);
for(const taxOverride of [-1,'bad',1e13])assert.equal((await call(api,'PUT',{...body,id:p.id,taxOverride})).status,400);
const euro=ok(await call(api,'POST',{...body,currency:'EUR',taxOverride:5})).purchase;assert.equal(euro.total,105);assert.equal(euro.totalLbp,11340000);
const lbp=ok(await call(api,'POST',{...body,currency:'LBP'})).purchase;assert.equal(lbp.totalLbp,lbp.total);assert.equal(lbp.lbpRate,1);
assert.equal(ok(await call(api,'GET')).purchases.find(x=>x.id===p.id).totalLbp,9934500);
assert.equal(sql.prepare('SELECT SUM(quantity) q FROM stock_transactions WHERE item_id=1').get().q,1006);
console.log('PASS purchase tax: manual/zero/automatic amounts, persisted override and dual totals, saved exchange rates, cross-currency and LBP purchases, journal amounts, edits, validation and unchanged landed costs.');
