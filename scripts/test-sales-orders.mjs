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
 'db/currencies.ts':`export const ensureCompanyCurrencies=async()=>{};export const getCurrency=async(company,code)=>company==='test'&&code==='USD'?({rate:1,active:true}):null;`
};
const cache=new Map();function moduleUrl(file){file=file.replaceAll('\\','/');if(cache.has(file))return cache.get(file);let source=overrides[file]??readFileSync(file,'utf8');source=source.replace(/from\s*(['"])(\.[^'"]*)\1/g,(match,quote,name)=>{let resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));if(!resolved.endsWith('.ts'))resolved=existsSync(resolved+'.ts')?resolved+'.ts':resolved+'/index.ts';return 'from '+JSON.stringify(moduleUrl(resolved))});const result=toUrl(source);cache.set(file,result);return result}
const orders=await import(moduleUrl('app/api/sales-orders/route.ts')),invoices=await import(moduleUrl('app/api/invoices/route.ts')),post=await import(moduleUrl('app/api/invoices/post/route.ts'));
const {invoiceTotals}=await import(moduleUrl('lib/invoice-totals.ts'));
async function call(api,method,body,query='',company='test'){const old=console.error;console.error=()=>{};try{const r=await api[method](new Request('http://test/api'+query,{method,headers:{company,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return{status:r.status,...await r.json()}}finally{console.error=old}}
const ok=r=>{assert.ok(r.status<300,JSON.stringify(r));return r};
const baseLine={lineType:'part',itemId:1,description:'Part',unit:'unit',quantity:10,unitPrice:100,lineDiscountRate:10,taxRate:11};
async function create(lines=[baseLine],discountRate=5){return ok(await call(orders,'POST',{requestKey:crypto.randomUUID(),customerId:1,state:'confirmed',currency:'USD',paymentTerms:'cash',orderDate:'2026-09-18',expectedDeliveryDate:'2026-09-20',lines,discountRate})).order.id}
const detail=async id=>ok(await call(orders,'GET',null,'?id='+id));
async function convert(id,quantities,extra={}){const d=await detail(id);return call(invoices,'POST',{requestKey:crypto.randomUUID(),salesOrderId:id,orderRevision:d.order.revision,orderLines:quantities.map((q,i)=>({id:d.lines[i].id,quantity:q})),invoiceDate:'2026-09-18',action:'post',...extra})}
let id=await create();assert.equal(sql.prepare('SELECT COUNT(*) n FROM invoices').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM accounting_transactions').get().n,0);assert.equal(sql.prepare('SELECT stock_qty q FROM items').get().q,1000);
const first=ok(await convert(id,[4]));let d=await detail(id);assert.equal(d.lines[0].remaining,6);assert.equal(d.order.status,'Partially Invoiced');assert.equal(sql.prepare('SELECT unit FROM invoice_lines WHERE invoice_id=?').get(first.invoice.id).unit,'unit');assert.equal((await convert(id,[7])).status,400);ok(await convert(id,[6]));d=await detail(id);assert.equal(d.order.status,'Fully Invoiced');assert.equal(d.lines[0].remaining,0);assert.equal((await convert(id,[1])).status,400);
assert.equal((await call(orders,'GET',null,'?id='+id,'other')).status,400);assert.equal((await call(orders,'GET',null,'','unauthorized')).status,401);
// Distinct simultaneous requests see the same revision; exactly one commits.
id=await create();d=await detail(id);const body={salesOrderId:id,orderRevision:d.order.revision,orderLines:[{id:d.lines[0].id,quantity:6}],invoiceDate:'2026-09-18',action:'draft',requestKey:'parallel-order-a'};
const race=await Promise.all([call(invoices,'POST',body),call(invoices,'POST',{...body,requestKey:'parallel-order-b'})]);assert.equal(race.filter(r=>r.status<300).length,1);d=await detail(id);assert.equal(d.lines[0].remaining,4);assert.equal(d.lines[0].reserved,6);assert.equal(d.order.status,'Confirmed');const winner=race.find(r=>r.status<300),winningBody=race[0].status<300?body:{...body,requestKey:'parallel-order-b'};assert.equal(ok(await call(invoices,'POST',winningBody)).duplicate,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM invoices WHERE sales_order_id=?').get(id).n,1);
assert.equal((await call(invoices,'POST',{...winningBody,orderLines:[{id:d.lines[0].id,quantity:2}]})).status,409);
assert.equal((await call(invoices,'PUT',{id:winner.invoice.id,revision:1})).status,409);
ok(await call(orders,'PATCH',{id,revision:d.order.revision,action:'cancelDraft',invoiceId:winner.invoice.id}));d=await detail(id);assert.equal(d.lines[0].remaining,10);assert.equal(d.lines[0].reserved,0);assert.equal((await call(post,'POST',{id:winner.invoice.id,revision:2,requestKey:'cancelled-post-attempt'})).status,409);
const report=ok(await call(invoices,'GET',null,'?report=1'));assert.ok(!report.invoices.some(i=>i.id===winner.invoice.id));const cancelled=ok(await call(invoices,'GET',null,'?id='+winner.invoice.id));assert.equal(cancelled.invoice.outstanding,0);
const replacement=ok(await convert(id,[4],{action:'draft'}));ok(await call(post,'POST',{id:replacement.invoice.id,revision:1,requestKey:'replacement-post'}));d=await detail(id);assert.equal(d.order.status,'Partially Invoiced');assert.equal(d.lines[0].remaining,6);ok(await call(orders,'PATCH',{id,revision:d.order.revision,action:'cancel'}));assert.equal((await detail(id)).order.status,'Cancelled');assert.equal((await convert(id,[6])).status,400);assert.equal(sql.prepare('SELECT document_state s FROM invoices WHERE id=?').get(replacement.invoice.id).s,'posted');
// Mixed VAT, discounts and final residual cents use original per-line budgets.
const lines=[{...baseLine,quantity:3,unitPrice:19.99,lineDiscountRate:7.5,taxRate:11},{...baseLine,lineType:'labor',itemId:null,description:'Service',unit:'hour',quantity:2.5,unitPrice:4.2,lineDiscountRate:20,taxRate:5},{...baseLine,lineType:'labor',itemId:null,description:'Exempt',quantity:2,unitPrice:80,lineDiscountRate:0,taxRate:0}];
id=await create(lines,7);ok(await convert(id,[1,.5,1]));ok(await convert(id,[2,2,1]));d=await detail(id);assert.equal(d.order.status,'Fully Invoiced');const original=invoiceTotals(lines,7);const discount=sql.prepare('SELECT ROUND(SUM(il.discount_amount),2) n FROM invoice_lines il JOIN invoices i ON i.id=il.invoice_id WHERE i.sales_order_id=?').get(id).n;assert.equal(discount,original.discountAmount);
for(const i of d.invoices){const inv=ok(await call(invoices,'GET',null,'?id='+i.id));const expected=invoiceTotals(inv.lines,7,inv.lines.map(l=>l.discountAmount));assert.equal(inv.invoice.total,expected.total);assert.equal(inv.invoice.tax,expected.tax);assert.equal(sql.prepare("SELECT ROUND(SUM(CASE indicator WHEN 'debit' THEN amount_currency ELSE -amount_currency END),2) n FROM accounting_transactions WHERE transaction_type='sale' AND source_id=?").get(i.id).n||0,0)}
id=await create();d=await detail(id);for(const quantity of [0,-1,11])assert.equal((await convert(id,[quantity])).status,400);assert.equal((await call(invoices,'POST',{...body,requestKey:crypto.randomUUID(),salesOrderId:id,orderRevision:d.order.revision,orderLines:[{id:d.lines[0].id,quantity:1},{id:d.lines[0].id,quantity:1}]})).status,400);
// Uninvoiced orders are editable, stale writes fail, conversion locks financial data.
const edit={id,revision:d.order.revision,requestKey:crypto.randomUUID(),customerId:1,state:'confirmed',currency:'USD',paymentTerms:'cash',orderDate:'2026-09-18',lines:[{...baseLine,quantity:12}],discountRate:5};ok(await call(orders,'PUT',edit));assert.equal((await call(orders,'PUT',edit)).status,400);ok(await convert(id,[1]));assert.equal((await call(orders,'PUT',{...edit,revision:(await detail(id)).order.revision})).status,400);
// Customer details are frozen; current credit/stock controls still run.
sql.exec("UPDATE customers SET name='Changed customer' WHERE id=1");const frozen=ok(await convert(id,[1]));assert.equal(ok(await call(invoices,'GET',null,'?id='+frozen.invoice.id)).customer.name,'Customer');sql.exec("UPDATE customers SET block_invoices=1 WHERE id=1");assert.equal((await convert(id,[1])).status,409);sql.exec('UPDATE customers SET block_invoices=0 WHERE id=1');
// Very small amounts and 100% discounts never create negative totals.
id=await create([{...baseLine,quantity:2,unitPrice:.01,lineDiscountRate:50}],100);ok(await convert(id,[1]));ok(await convert(id,[1]));assert.ok((await detail(id)).invoices.every(i=>i.total>=0));
console.log('Passed sales orders: 4+6 lifecycle, no order ledger effects, company permissions, multiple lines, concurrency, replay, cancellation, draft posting, immutable history, customer snapshot, VAT, discounts, rounding and balanced accounting.');
id=await create();let draftDelete=ok(await convert(id,[3],{action:'draft'}));ok(await call(invoices,'DELETE',{id:draftDelete.invoice.id,revision:1}));assert.equal((await detail(id)).lines[0].remaining,10);assert.equal((await call(invoices,'DELETE',{id:first.invoice.id,revision:1})).status,409);
// Reversal does not recreate demand; an explicit replacement order is required.
const toReverse=ok(await convert(id,[2]));sql.prepare("UPDATE invoices SET document_state='reversed' WHERE id=?").run(toReverse.invoice.id);d=await detail(id);assert.equal(d.lines[0].remaining,8);assert.equal(d.lines[0].invoiced,0);
// The all-remaining action is server-selected; ignores supplied prices/customer.
ok(await convert(id,[],{invoiceAllRemaining:true,customerId:999,discountRate:99,currency:'INVALID'}));d=await detail(id);assert.equal(d.lines[0].remaining,0);
console.log('Passed draft deletion, reversal treatment, and server-controlled all-remaining conversion.');

