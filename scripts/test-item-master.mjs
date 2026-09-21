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
const itemsApi=await import(moduleUrl('app/api/items/route.ts')),listsApi=await import(moduleUrl('app/api/item-master-values/route.ts')),adjustApi=await import(moduleUrl('app/api/items/adjust-stock/route.ts')),purchases=await import(moduleUrl('app/api/purchases/route.ts')),returns=await import(moduleUrl('app/api/sales-returns/route.ts')),returnPost=await import(moduleUrl('app/api/sales-returns/post/route.ts'));
const getItem=async id=>ok(await call(itemsApi,'GET')).items.find(i=>i.id===id);
const stock=id=>sql.prepare('SELECT stock_qty q FROM items WHERE id=?').get(id).q;
const key=()=>crypto.randomUUID();
sql.exec("INSERT INTO suppliers(id,company_code,name,account_number) VALUES(1,'test','Supplier One','2100'),(2,'test','Supplier Two','2101'),(3,'other','Other Supplier','2100');");
const oldItem=await getItem(1);assert.equal(oldItem.stockQty,1000);assert.equal(oldItem.baseUnit,'unit');assert.equal(oldItem.active,true);
for(const entry of [{category:'group',name:'Parts'},{category:'subgroup',name:'Filters',parent:'Parts'},{category:'brand',name:'Maker'}])ok(await call(listsApi,'POST',entry));
const master={...oldItem,group:'Parts',subgroup:'Filters',brand:'Maker',units:[{code:'unit',factor:1},{code:'box',factor:12},{code:'half',factor:.5}],salesUnit:'box',purchaseUnit:'box',barcodes:[{code:'0000123',unit:'unit',primary:true},{code:'0000456',unit:'box',primary:false}],itemSuppliers:[{supplierId:1,itemCode:'SUP-BOX',unit:'box',isDefault:true},{supplierId:2,itemCode:'SUP-EACH',unit:'unit',isDefault:false}]};
ok(await call(itemsApi,'PUT',master));let item=await getItem(1);assert.equal(stock(1),1000);assert.equal(item.barcodes[0].code,'0000123');assert.equal(item.itemSuppliers.length,2);
assert.equal((await call(itemsApi,'PUT',{...item,stockQty:1001})).status,400);
assert.equal((await call(itemsApi,'PUT',{...item,units:[{code:'unit',factor:1},{code:'box',factor:10}]})).status,400);
assert.equal((await call(itemsApi,'POST',{...item,id:undefined,sku:'DUP',stockQty:0})).status,409);assert.equal(sql.prepare("SELECT COUNT(*) n FROM items WHERE sku='DUP'").get().n,0);
assert.equal((await call(itemsApi,'PUT',{...item,barcodes:item.barcodes.map(b=>({...b,primary:false}))})).status,400);
assert.equal((await call(itemsApi,'PUT',{...item,itemSuppliers:[{supplierId:3,itemCode:'',unit:'unit',isDefault:true}]})).status,400);
assert.equal((await call(itemsApi,'PUT',{...item,subgroup:'Missing'})).status,400);
const race=await Promise.all([call(itemsApi,'PUT',{...item,name:'Race A'}),call(itemsApi,'PUT',{...item,name:'Race B'})]);assert.equal(race.filter(r=>r.status===200).length,1);
const adjustment={itemId:1,unit:'box',quantity:2,expectedStock:1000,reason:'Opening count',requestKey:key()};ok(await call(adjustApi,'POST',adjustment));assert.equal(stock(1),1024);assert.equal((await call(adjustApi,'POST',adjustment)).status,409);assert.equal(stock(1),1024);assert.equal((await call(adjustApi,'POST',{...adjustment,expectedStock:1024,reason:'',requestKey:key()})).status,409);
const purchase={supplierId:1,purchaseDate:'2026-09-19',currency:'USD',taxRate:0,lines:[{itemId:1,description:'Filter',quantity:2,unitCost:120}]};let p=ok(await call(purchases,'POST',purchase));assert.equal(stock(1),1048);let pl=ok(await call(purchases,'GET',null,'?id='+p.purchase.id));assert.equal(pl.lines[0].unit,'box');assert.equal(pl.lines[0].unitFactor,12);assert.equal((await getItem(1)).averageCost,10);
ok(await call(purchases,'PUT',{...purchase,id:p.purchase.id,lines:[{...purchase.lines[0],unit:'unit',quantity:6,unitCost:10}]}));assert.equal(stock(1),1030);assert.equal((await getItem(1)).averageCost,10);
ok(await call(purchases,'POST',{...purchase,supplierId:2,lines:[{...purchase.lines[0],quantity:3,unitCost:10}]}));assert.equal(stock(1),1033);
const line={lineType:'part',itemId:1,description:'Filter box',unit:'box',unitFactor:999,quantity:2,unitPrice:240,lineDiscountRate:0,taxRate:11};
let inv=ok(await call(invoices,'POST',{action:'post',requestKey:key(),customerId:1,invoiceDate:'2026-09-19',currency:'USD',discountRate:0,lines:[line]}));assert.equal(stock(1),1009);const invId=inv.invoice.id;let saved=ok(await call(invoices,'GET',null,'?id='+invId));assert.equal(saved.lines[0].unitFactor,12);assert.equal(saved.invoice.total,532.8);
let r=ok(await call(returns,'POST',{requestKey:key(),originalInvoiceId:invId,customerId:1,returnDate:'2026-09-19',reason:'Half a box returned',lines:[{originalInvoiceLineId:saved.lines[0].id,quantity:.5}]}));ok(await call(returnPost,'POST',{id:r.note.id,revision:1,requestKey:key()}));assert.equal(stock(1),1015);
const order=ok(await call(orders,'POST',{requestKey:key(),customerId:1,state:'confirmed',currency:'USD',orderDate:'2026-09-19',discountRate:0,lines:[{...line,quantity:3}]}));let od=ok(await call(orders,'GET',null,'?id='+order.order.id));assert.equal(od.lines[0].unitFactor,12);assert.equal(stock(1),1015);
inv=ok(await call(invoices,'POST',{requestKey:key(),salesOrderId:od.order.id,orderRevision:od.order.revision,orderLines:[{id:od.lines[0].id,quantity:1}],invoiceDate:'2026-09-19',action:'draft'}));assert.equal(stock(1),1015);ok(await call(post,'POST',{id:inv.invoice.id,revision:1,requestKey:key()}));assert.equal(stock(1),1003);od=ok(await call(orders,'GET',null,'?id='+od.order.id));assert.equal(od.lines[0].remaining,2);
// Defaults change for new selections only; saved orders and historical returns keep the snapshot.
item=await getItem(1);ok(await call(itemsApi,'PUT',{...item,salesUnit:'half'}));
ok(await call(invoices,'POST',{requestKey:key(),salesOrderId:od.order.id,orderRevision:od.order.revision,orderLines:[{id:od.lines[0].id,quantity:2}],invoiceDate:'2026-09-19',action:'post'}));assert.equal(stock(1),979);
const draft=ok(await call(invoices,'POST',{action:'draft',requestKey:key(),customerId:1,invoiceDate:'2026-09-19',currency:'USD',lines:[{...line,unit:'unit',quantity:1}]}));item=await getItem(1);ok(await call(itemsApi,'PUT',{...item,active:false}));assert.ok((await call(post,'POST',{id:draft.invoice.id,revision:1,requestKey:key()})).status>=400);assert.equal(stock(1),979);assert.ok((await call(purchases,'POST',purchase)).status>=400);assert.ok((await call(invoices,'POST',{requestKey:key(),customerId:1,invoiceDate:'2026-09-19',lines:[line]})).status>=400);
r=ok(await call(returns,'POST',{requestKey:key(),originalInvoiceId:invId,customerId:1,returnDate:'2026-09-19',reason:'Remaining boxes returned',lines:[{originalInvoiceLineId:saved.lines[0].id,quantity:1.5}]}));ok(await call(returnPost,'POST',{id:r.note.id,revision:1,requestKey:key()}));assert.equal(stock(1),997);
assert.equal(sql.prepare('SELECT SUM(quantity) q FROM stock_transactions WHERE item_id=1').get().q,997);
assert.equal((await call(itemsApi,'GET',null,'','other')).items.length,0);
console.log('PASS Items Master: legacy defaults, managed lists, unit validation, duplicate barcodes/atomic rollback, suppliers/company isolation, concurrent edits, reasoned/replay-safe adjustments, purchase units/edit reversal/cost, invoice factors/forgery rejection, fractional returns, partial order conversion/draft posting, inactive blocking, immutable history and ledger reconciliation.');
