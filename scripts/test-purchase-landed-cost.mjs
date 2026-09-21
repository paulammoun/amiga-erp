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

const purchases=await import(moduleUrl('app/api/purchases/route.ts'));
sql.exec(`INSERT INTO suppliers(id,company_code,name,account_number) VALUES(1,'test','Supplier','2100'); INSERT INTO currencies(company_code,code,name,rate,active) VALUES('test','EUR','Euro',1.2,1),('test','GBP','Pound',1.5,1),('other','CAD','Other only',2,1); INSERT INTO items(id,company_code,sku,name,stock_qty,master_json) VALUES(2,'test','BOX','Boxes',0,'{"units":[{"code":"unit","factor":1},{"code":"box","factor":12}],"baseUnit":"unit","purchaseUnit":"box","salesUnit":"unit"}');`);
const body={supplierId:1,purchaseDate:'2026-09-19',currency:'EUR',taxRate:10,lines:[{itemId:1,description:'Single units',unit:'unit',quantity:2,unitCost:100},{itemId:2,description:'Boxes',unit:'box',quantity:1,unitCost:100}],expenses:[{category:'Freight',description:'Delivery',currency:'USD',amount:36},{category:'Customs',description:'Clearance',currency:'GBP',amount:24}]};
const p=ok(await call(purchases,'POST',body));const id=p.purchase.id;
let saved=ok(await call(purchases,'GET',null,'?id='+id));
assert.equal(saved.purchase.total,330);assert.equal(saved.purchase.expensesLocal,72);assert.equal(saved.purchase.expensePercent,20);assert.equal(saved.purchase.currencyRate,1.2);
assert.equal(saved.lines[0].unitCost,100);assert.equal(saved.lines[0].landedUnitCost,120);assert.equal(saved.lines[1].unitFactor,12);
assert.equal(sql.prepare('SELECT stock_qty q FROM items WHERE id=2').get().q,12);
assert.equal(sql.prepare("SELECT unit_cost c FROM stock_transactions WHERE item_id=2 AND transaction_type='purchase'").get().c,10);
assert.equal(sql.prepare("SELECT SUM(amount_currency) a FROM accounting_transactions WHERE reference=? AND indicator='credit'").get(p.purchase.purchaseNumber).a,330);
// Saved conversion rates win over changed configuration and forged client rates.
sql.exec("UPDATE currencies SET rate=4 WHERE code IN ('EUR','GBP');");
ok(await call(purchases,'PUT',{...body,id,expenses:saved.purchase.expenses.map(e=>({...e,rate:999}))}));
saved=ok(await call(purchases,'GET',null,'?id='+id));assert.equal(saved.purchase.expensesLocal,72);assert.equal(saved.purchase.currencyRate,1.2);assert.equal(saved.lines[0].landedUnitCost,120);
assert.equal(sql.prepare("SELECT amount_local_currency a FROM accounting_transactions WHERE reference=? AND indicator='credit'").get(p.purchase.purchaseNumber).a,396);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM stock_transactions WHERE transaction_type='purchase'").get().n,2);
const stockBefore=sql.prepare('SELECT stock_qty q FROM items WHERE id=1').get().q;
for(const expenses of [[{...body.expenses[0],amount:-1}],[{...body.expenses[0],currency:'CAD'}],[{...body.expenses[0],category:''}],[{...body.expenses[0],amount:1e15}],Array.from({length:101},()=>body.expenses[0])])assert.equal((await call(purchases,'PUT',{...body,id,expenses})).status,400);
assert.equal((await call(purchases,'POST',{...body,lines:body.lines.map(l=>({...l,unitCost:0}))})).status,400);
assert.equal((await call(purchases,'GET',null,'?id='+id,'other')).status,404);assert.equal((await call(purchases,'POST',body,'','unauthorized')).status,401);
assert.equal(sql.prepare('SELECT stock_qty q FROM items WHERE id=1').get().q,stockBefore);
ok(await call(purchases,'PUT',{...body,id,expenses:[]}));saved=ok(await call(purchases,'GET',null,'?id='+id));assert.equal(saved.purchase.expensePercent,0);assert.equal(saved.lines[0].unitCost,100);assert.equal(saved.lines[0].landedUnitCost,100);assert.equal(saved.purchase.expenses.length,0);
assert.equal(sql.prepare("SELECT unit_cost c FROM stock_transactions WHERE item_id=2 AND transaction_type='purchase'").get().c,100/12);
assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
// The additive migration leaves all previously saved values intact.
const legacy=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0044').sort())legacy.exec(readFileSync('drizzle/'+f,'utf8'));
legacy.exec("INSERT INTO suppliers(id,company_code,name) VALUES(1,'old','Supplier'); INSERT INTO items(id,company_code,sku,name,stock_qty) VALUES(1,'old','OLD','Original',3); INSERT INTO purchase_invoices(id,company_code,purchase_number,supplier_id,supplier_name,purchase_date,currency,subtotal,total) VALUES(1,'old','PUR-OLD',1,'Supplier','2025-01-01','USD',30,30); INSERT INTO purchase_invoice_lines(purchase_invoice_id,item_id,description,quantity,unit_cost,line_total) VALUES(1,1,'Original',3,10,30);");
const before=Object.fromEntries(['items','purchase_invoices','purchase_invoice_lines'].map(t=>[t,legacy.prepare('SELECT * FROM '+t).all()]));legacy.exec(readFileSync('drizzle/0044_shiny_karen_page.sql','utf8'));
for(const [table,rows] of Object.entries(before)){const after=legacy.prepare('SELECT * FROM '+table).all();for(let i=0;i<rows.length;i++)for(const col of Object.keys(rows[i]))assert.deepEqual(after[i][col],rows[i][col]);}
assert.equal(legacy.prepare('SELECT COALESCE(landed_unit_cost,unit_cost) c FROM purchase_invoice_lines').get().c,10);
console.log('PASS purchase landed costs: mixed currencies, proportional allocation, original costs and supplier totals, unit conversions and stock valuation, saved-rate integrity, edit/removal reversal, invalid expenses and company isolation, additive historical migration.');
