import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sqlite = new DatabaseSync(':memory:');
for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) {
  if(name === '0033_invoice_discount.sql') {
    sqlite.exec("INSERT INTO customers(id,company_code,name,default_discount) VALUES(99,'legacy','Legacy',15); INSERT INTO invoices(id,company_code,invoice_number,customer_id,subtotal,tax,total) VALUES(99,'legacy','INV-000001',99,90,9.9,99.9);");
  }
  sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
}
assert.deepEqual({...sqlite.prepare('SELECT subtotal,tax,total,discount_rate,discount_amount FROM invoices WHERE id=99').get()}, {subtotal:90,tax:9.9,total:99.9,discount_rate:0,discount_amount:0});
sqlite.exec("INSERT INTO workshop_settings(company_code,default_tax,sales_account_number,tax_account_number,default_currency,local_currency,local_currency_rate) VALUES('test',11,'4000','2200','USD','LBP',89500); INSERT INTO customers(id,company_code,name,default_discount,account_number) VALUES(1,'test','Discount customer',10,'1100'),(2,'test','Other customer',20,'1101'); INSERT INTO items(id,company_code,sku,name,sale_price,vat_rate,stock_qty) VALUES(1,'test','A','Part',100,11,100); INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('test',1,'opening','Opening','2026-09-17',100);");
const db={prepare(sql){return {sql,args:[],bind(...args){return {...this,args}},async first(){return sqlite.prepare(this.sql).get(...this.args)??null},async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}}},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.args));sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.discountTestDb=db;
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const load=name=>readFileSync(name,'utf8');
const dbImport='const getRawDb=()=>globalThis.discountTestDb;';
const modules={stock:url(load('db/stock.ts').replace(/import .* from "\.\/index";/,dbImport)),accounting:url(load('db/accounting.ts').replace(/import .* from "\.\/index";/,dbImport)),receivables:url(load('db/receivables.ts')),totals:url(load('lib/invoice-totals.ts'))};
let source=load('app/api/invoices/route.ts');
for(const name of ['stock','accounting','receivables'])source=source.replace(`from "../../../db/${name}"`,`from "${modules[name]}"`);
source=source.replace('from "../../../lib/invoice-totals"',`from "${modules.totals}"`).replace(/import .* from "\.\.\/\.\.\/\.\.\/db";/,dbImport).replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/auth";/,'const requireUser=async request=>({companyCode:request.headers.get("company")||"test"});').replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/settings";/,'const getWorkshopSettings=async()=>({defaultTax:11,defaultCurrency:"USD",localCurrency:"LBP",localCurrencyRate:89500});').replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/currencies";/,'const ensureCompanyCurrencies=async()=>{};const getCurrency=async(_company,code)=>({code,rate:89500,active:true});');
const api=await import(url(source));
async function call(method,body,query='',company='test'){const response=await api[method](new Request('http://test/api/invoices'+query,{method,headers:{company,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,data:await response.json()};}
const draft={customerId:1,invoiceDate:'2026-09-17',mileage:0,lines:[{lineType:'part',itemId:1,description:'Part',quantity:1,unitPrice:100,taxRate:11},{lineType:'labor',description:'Labor',quantity:1,unitPrice:50,taxRate:0}]};
const created=await call('POST',draft);assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.invoice.id;
let saved=(await call('GET',null,'?id='+id)).data;
assert.equal(saved.invoice.discountRate,10);assert.equal(saved.invoice.discountAmount,15);assert.equal(saved.invoice.subtotal,135);assert.equal(saved.invoice.tax,9.9);assert.equal(saved.invoice.total,144.9);
assert.equal(saved.lines[0].unitPrice,100);assert.equal(saved.lines[0].discountAmount,10);assert.equal(saved.lines[1].discountAmount,5);
const balanced=()=>assert.equal(sqlite.prepare("SELECT ROUND(SUM(CASE indicator WHEN 'debit' THEN amount_currency ELSE -amount_currency END),2) balance FROM accounting_transactions WHERE source_id=? AND transaction_type='sale'").get(id).balance||0,0);
balanced();
sqlite.exec('UPDATE customers SET default_discount=25 WHERE id=1');
assert.equal((await call('PUT',{...draft,id})).status,200);
assert.equal((await call('GET',null,'?id='+id)).data.invoice.discountRate,10);
assert.equal((await call('PUT',{...draft,id,discountRate:5})).status,200);
saved=(await call('GET',null,'?id='+id)).data;assert.equal(saved.invoice.total,152.95);balanced();
assert.equal((await call('PUT',{...draft,id,discountRate:0})).status,200);
assert.equal((await call('GET',null,'?id='+id)).data.invoice.total,161);
assert.equal((await call('PUT',{...draft,id,customerId:2})).status,200);
assert.equal((await call('GET',null,'?id='+id)).data.invoice.discountRate,20);
for(const rate of [-1,101,'bad']){assert.equal((await call('POST',{...draft,discountRate:rate})).status,400);assert.equal((await call('PUT',{...draft,id,discountRate:rate})).status,400);}
assert.equal((await call('GET',null,'?id='+id,'other')).status,404);
assert.equal((await call('PUT',{...draft,id,customerId:2,discountRate:100})).status,200);assert.equal((await call('GET',null,'?id='+id)).data.invoice.total,0);balanced();
assert.equal((await call('PUT',{...draft,id,discountRate:0})).status,200);
sqlite.exec(`INSERT INTO customer_receipts(id,company_code,receipt_number,customer_id,receipt_date,amount,invoice_currency_amount,account_number) VALUES(1,'test','REC-1',1,'2026-09-17',100,100,'1000'); INSERT INTO receipt_invoice_allocations(company_code,receipt_id,invoice_id,amount) VALUES('test',1,${id},100);`);
assert.equal((await call('PUT',{...draft,id,discountRate:90})).status,409);
assert.equal((await call('GET',null,'?id='+id)).data.invoice.outstanding,61);
const {invoiceTotals}=await import(modules.totals);
for(const rate of [0,3.33,10,33.33,100]){
 const totals=invoiceTotals([{quantity:3,unitPrice:.05,taxRate:11},{quantity:1,unitPrice:.07,taxRate:5},{quantity:2,unitPrice:10.33,taxRate:0}],rate);
 assert.equal(Math.round(totals.lines.reduce((s,l)=>s+l.discountAmount,0)*100),Math.round(totals.discountAmount*100));
 assert.equal(Math.round(totals.lines.reduce((s,l)=>s+l.total,0)*100),Math.round(totals.total*100));
}
console.log('Passed migration preservation, customer defaults, overrides, save/reopen, mixed VAT, rounding, full discount, balanced accounting, receipt protection and company isolation.');

for(let n=0;n<505;n++)sqlite.prepare("INSERT INTO invoices(company_code,invoice_number,invoice_date,customer_id,subtotal,total) VALUES('test',?,'2026-09-17',1,1,1)").run('REPORT-'+n);
assert.equal((await call('GET')).data.invoices.length,100);
const firstPage=await call('GET',null,'?report=1');
assert.equal(firstPage.data.invoices.length,500);assert.ok(firstPage.data.nextCursor);
const secondPage=await call('GET',null,'?report=1&beforeId='+firstPage.data.nextCursor);
assert.equal(secondPage.data.invoices.length,6);assert.equal(secondPage.data.nextCursor,null);
assert.equal(new Set([...firstPage.data.invoices,...secondPage.data.invoices].map(i=>i.id)).size,506);
assert.equal((await call('GET',null,'?report=1','other')).data.invoices.length,0);
assert.equal((await call('GET',null,'?report=1&beforeId=invalid')).status,400);
console.log('Passed invoice report pagination beyond 500 rows, no duplicates, company isolation and cursor validation.');
