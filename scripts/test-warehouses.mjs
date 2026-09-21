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


const warehouses=await import(moduleUrl('app/api/warehouses/route.ts')),purchase=await import(moduleUrl('app/api/purchases/route.ts')),invoice=await import(moduleUrl('app/api/invoices/route.ts')),postInvoice=await import(moduleUrl('app/api/invoices/post/route.ts')),orders=await import(moduleUrl('app/api/sales-orders/route.ts')),returns=await import(moduleUrl('app/api/sales-returns/route.ts')),postReturn=await import(moduleUrl('app/api/sales-returns/post/route.ts')),transfers=await import(moduleUrl('app/api/warehouse-transfers/route.ts')),adjust=await import(moduleUrl('app/api/items/adjust-stock/route.ts')),inventory=await import(moduleUrl('app/api/stock-inventory/route.ts')),ledger=await import(moduleUrl('app/api/stock-transactions/route.ts'));
const key=()=>crypto.randomUUID(),qty=(w)=>sql.prepare('SELECT COALESCE(SUM(quantity),0) q FROM stock_transactions WHERE item_id=1 AND warehouse_code=?').get(w).q;
sql.exec(`INSERT INTO suppliers(id,company_code,name) VALUES(1,'test','Supplier'); UPDATE items SET master_json='{"units":[{"code":"unit","factor":1},{"code":"box","factor":12}],"baseUnit":"unit","salesUnit":"unit","purchaseUnit":"unit"}' WHERE id=1;`);
assert.equal(ok(await call(warehouses,'GET')).warehouses[0].code,'MAIN');assert.equal(qty('MAIN'),1000);
for(const code of ['SECOND','EMPTY'])ok(await call(warehouses,'POST',{code,name:code+' Warehouse'}));
assert.equal((await call(warehouses,'POST',{code:'SECOND',name:'Duplicate'})).status,400);
const wh=ok(await call(warehouses,'GET')).warehouses.find(w=>w.code==='SECOND');
const p={supplierId:1,purchaseDate:'2026-09-19',currency:'USD',taxRate:0,warehouseCode:'SECOND',lines:[{itemId:1,description:'Boxes',unit:'box',quantity:2,unitCost:120}]};
const savedP=ok(await call(purchase,'POST',p)).purchase;assert.equal(qty('SECOND'),24);assert.equal(qty('MAIN'),1000);assert.equal(ok(await call(purchase,'GET',null,'?id='+savedP.id)).purchase.warehouseCode,'SECOND');
const sale={customerId:1,warehouseCode:'SECOND',invoiceDate:'2026-09-19',currency:'USD',action:'post',lines:[{lineType:'part',itemId:1,unit:'unit',description:'Part',quantity:2,unitPrice:20,lineDiscountRate:0,taxRate:0}]};
assert.equal((await call(invoice,'POST',{...sale,requestKey:key(),lines:[{...sale.lines[0],quantity:25}]})).status,409);
const sold=ok(await call(invoice,'POST',{...sale,requestKey:key()})).invoice;assert.equal(qty('SECOND'),22);assert.equal(qty('MAIN'),1000);
// Moving a consumed purchase cannot silently leave its original warehouse negative.
assert.ok((await call(purchase,'PUT',{...p,id:savedP.id,warehouseCode:'MAIN'})).status>=400);assert.equal(qty('SECOND'),22);
const source=ok(await call(invoice,'GET',null,'?id='+sold.id));assert.equal(source.invoice.warehouseCode,'SECOND');
const ret=ok(await call(returns,'POST',{requestKey:key(),originalInvoiceId:sold.id,customerId:1,warehouseCode:'MAIN',returnDate:'2026-09-19',reason:'Return one',lines:[{originalInvoiceLineId:source.lines[0].id,quantity:1}]})).note;ok(await call(postReturn,'POST',{id:ret.id,revision:1,requestKey:key()}));assert.equal(qty('SECOND'),23);assert.equal(ret.warehouse_code,'SECOND');
const transfer={fromWarehouse:'MAIN',toWarehouse:'SECOND',itemId:1,unit:'unit',quantity:10,reason:'Replenish',requestKey:key()};ok(await call(transfers,'POST',transfer));assert.equal(qty('MAIN'),990);assert.equal(qty('SECOND'),33);assert.equal((await call(transfers,'POST',transfer)).status,409);
assert.equal((await call(transfers,'POST',{...transfer,quantity:991,requestKey:key()})).status,409);assert.equal(qty('MAIN'),990);
ok(await call(adjust,'POST',{warehouseCode:'SECOND',itemId:1,unit:'unit',quantity:2,expectedStock:33,reason:'Count correction',requestKey:key()}));assert.equal(qty('SECOND'),35);
assert.equal((await call(adjust,'POST',{warehouseCode:'MAIN',itemId:1,unit:'unit',quantity:2,expectedStock:35,reason:'Wrong balance',requestKey:key()})).status,409);
const order=ok(await call(orders,'POST',{requestKey:key(),customerId:1,warehouseCode:'SECOND',state:'confirmed',currency:'USD',orderDate:'2026-09-19',discountRate:0,lines:sale.lines})).order;
const od=ok(await call(orders,'GET',null,'?id='+order.id));assert.equal(od.order.warehouseCode,'SECOND');
const converted=ok(await call(invoice,'POST',{requestKey:key(),salesOrderId:order.id,warehouseCode:'MAIN',orderRevision:1,invoiceAllRemaining:true,invoiceDate:'2026-09-19',action:'draft'})).invoice;
assert.equal(ok(await call(invoice,'GET',null,'?id='+converted.id)).invoice.warehouseCode,'SECOND');ok(await call(postInvoice,'POST',{id:converted.id,revision:1,requestKey:key()}));assert.equal(qty('SECOND'),33);
// Separate drafts racing for one warehouse cannot spend other warehouses' stock.
const drafts=[];for(let i=0;i<2;i++)drafts.push(ok(await call(invoice,'POST',{...sale,requestKey:key(),action:'draft',lines:[{...sale.lines[0],quantity:20}]})).invoice);
const race=await Promise.all(drafts.map(d=>call(postInvoice,'POST',{id:d.id,revision:1,requestKey:key()})));assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(qty('SECOND'),13);
assert.equal((await call(warehouses,'PUT',{...wh,active:0})).status,400);
const empty=ok(await call(warehouses,'GET')).warehouses.find(w=>w.code==='EMPTY');ok(await call(warehouses,'PUT',{...empty,active:0}));assert.ok((await call(purchase,'POST',{...p,warehouseCode:'EMPTY'})).status>=400);
ok(await call(warehouses,'POST',{code:'OTHER',name:'Other company'},'','other'));assert.ok((await call(purchase,'POST',{...p,warehouseCode:'OTHER'})).status>=400);assert.ok(!ok(await call(warehouses,'GET')).warehouses.some(w=>w.code==='OTHER'));
const report=ok(await call(inventory,'GET',null,'?from=2020-01-01&to=2030-01-01&warehouseCode=SECOND'));assert.equal(report.items[0].closingQty,13);
const all=ok(await call(inventory,'GET',null,'?from=2020-01-01&to=2030-01-01'));assert.equal(all.items[0].closingQty,1003);
const movements=ok(await call(ledger,'GET',null,'?warehouseCode=SECOND'));assert.ok(movements.transactions.every(t=>t.warehouseCode==='SECOND'));assert.equal(movements.transactions[0].balance,13);
assert.equal(sql.prepare('SELECT stock_qty q FROM items WHERE id=1').get().q,1003);
// Fractional units tolerate floating-point noise without borrowing another warehouse's stock.
sql.exec("INSERT INTO items(id,company_code,sku,name,stock_qty) VALUES(2,'test','F','Fraction',0.3); INSERT INTO stock_transactions(company_code,item_id,warehouse_code,transaction_type,reference,transaction_date,quantity) VALUES('test',2,'SECOND','opening','Fraction','',0.3);");
for(const quantity of [.1,.2])ok(await call(invoice,'POST',{...sale,requestKey:key(),lines:[{...sale.lines[0],itemId:2,quantity}]}));
// Migration adds only warehouse classification; historical numeric values survive.
const legacy=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0046').sort())legacy.exec(readFileSync('drizzle/'+f,'utf8'));
legacy.exec("INSERT INTO items(id,company_code,sku,name,stock_qty) VALUES(1,'old','A','Old',7); INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('old',1,'opening','Opening','',7);");
const before=legacy.prepare('SELECT * FROM stock_transactions').get();legacy.exec(readFileSync('drizzle/0046_watery_satana.sql','utf8'));const after=legacy.prepare('SELECT * FROM stock_transactions').get();for(const col of Object.keys(before))assert.equal(after[col],before[col]);assert.equal(after.warehouse_code,'MAIN');assert.equal(legacy.prepare('SELECT COUNT(*) n FROM warehouses').get().n,0);assert.equal(legacy.prepare('SELECT stock_qty q FROM items').get().q,7);
console.log('PASS warehouses: master, legacy migration, purchase units, per-warehouse availability, purchase edit rollback, original-warehouse returns, atomic transfers/replay, adjustments, order inheritance/draft posting, concurrent shortages, inactive/company isolation, inventory and ledger reconciliation.');
