import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sqlite=new DatabaseSync(':memory:');
const journal=JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8'));
for(const entry of journal.entries.slice(0,-1))sqlite.exec(readFileSync(resolve(root,`drizzle/${entry.tag}.sql`),'utf8'));
sqlite.exec(`
 INSERT INTO items(id,company_code,sku,name,stock_qty) VALUES(1,'default','A','Part A',20),(2,'default','B','Part B',7),(3,'other','A','Other company',50);
 INSERT INTO customers(id,company_code,name) VALUES(1,'default','Customer'),(2,'other','Other customer');
 INSERT INTO suppliers(id,company_code,name) VALUES(1,'default','Supplier'),(2,'other','Other supplier');
 INSERT INTO purchase_invoices(id,company_code,purchase_number,supplier_id,supplier_name,purchase_date,currency,subtotal) VALUES(1,'default','PUR-000001',1,'Supplier','2026-09-01','USD',50);
 INSERT INTO purchase_invoice_lines(purchase_invoice_id,item_id,description,quantity,unit_cost,line_total) VALUES(1,1,'Part A',10,5,50);
 INSERT INTO invoices(id,company_code,invoice_number,customer_id) VALUES(1,'default','INV-000001',1);
 INSERT INTO invoice_lines(invoice_id,line_type,item_id,description,quantity,unit_price,line_total) VALUES(1,'part',1,'Part A',3,10,30);
`);
sqlite.exec(readFileSync(resolve(root,'drizzle/0016_stock_transactions.sql'),'utf8'));
sqlite.exec(readFileSync(resolve(root,'drizzle/0017_stock_transaction_selling_price.sql'),'utf8'));
for(const migration of ['0018_customer_account_number.sql','0019_supplier_account_number.sql','0020_sales_tax_ledger_accounts.sql','0021_purchase_ledger_accounts.sql','0022_accounting_transactions.sql','0023_accounts_master.sql','0024_manual_journal_vouchers.sql','0025_salesmen_master.sql'])sqlite.exec(readFileSync(resolve(root,`drizzle/${migration}`),'utf8'));
sqlite.exec("INSERT OR IGNORE INTO workshop_settings(id,company_code) VALUES(1,'default'); UPDATE customers SET account_number=CASE id WHEN 1 THEN '1100' ELSE '1199' END; UPDATE suppliers SET account_number=CASE id WHEN 1 THEN '2100' ELSE '2199' END; UPDATE workshop_settings SET sales_account_number='4000',tax_account_number='2200',purchase_account_number='5000',purchase_tax_account_number='1200',local_currency='LBP',local_currency_rate=89500; INSERT INTO accounts(company_code,account_number,name,account_type,currency) VALUES('default','1000','Cash','asset','USD'),('default','3000','Capital','equity','USD'),('default','9999','Inactive','other','USD'); UPDATE accounts SET active=0 WHERE account_number='9999';");
sqlite.exec('PRAGMA foreign_keys=ON');
const d1={prepare(sql){return {sql,args:[],bind(...args){return {...this,args}},async first(){return sqlite.prepare(this.sql).get(...this.args)??null},async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}}},async batch(statements){
 sqlite.exec('BEGIN');
 try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.args));sqlite.exec('COMMIT');return result.map(value=>({...value,success:true}))}
 catch(error){sqlite.exec('ROLLBACK');throw error}
}};
globalThis.__stockTestDb=d1;
function moduleUrl(source){return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}
const dbImport='const getRawDb=()=>globalThis.__stockTestDb;';
const stockUrl=moduleUrl(readFileSync(resolve(root,'db/stock.ts'),'utf8').replace(/import .* from "\.\/index";/,dbImport));
const stock=await import(stockUrl);
const accountingUrl=moduleUrl(readFileSync(resolve(root,'db/accounting.ts'),'utf8').replace(/import .* from "\.\/index";/,dbImport));
async function route(name){
 let source=readFileSync(resolve(root,`app/api/${name}/route.ts`),'utf8')
  .replace(/from "\.\.\/\.\.\/\.\.\/db\/stock"/g,`from "${stockUrl}"`)
  .replace(/from "\.\.\/\.\.\/\.\.\/db\/accounting"/g,`from "${accountingUrl}"`)
  .replace(/import .* from "\.\.\/\.\.\/\.\.\/db";/,dbImport)
  .replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/auth";/,'const requireUser=async request=>request.headers.has("company")?{companyCode:request.headers.get("company")}:new Response("Unauthorized",{status:401});')
  .replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/settings";/,'const getWorkshopSettings=async()=>({defaultTax:11,localCurrency:"LBP",localCurrencyRate:89500});');
 return import(moduleUrl(source));
}
const purchases=await route('purchases'),invoices=await route('invoices'),items=await route('items'),ledger=await route('stock-transactions'),journals=await route('journal-vouchers'),trialBalance=await route('trial-balance'),accountStatement=await route('account-statement'),salesmenApi=await route('salesmen'),customersApi=await route('customers');
async function call(api,method,body,company='default',query=''){
 const response=await api[method](new Request('http://test/api'+query,{method,headers:{'content-type':'application/json',...(company?{company}:{})},...(body?{body:JSON.stringify(body)}:{})}));
 return {status:response.status,data:await response.json().catch(()=>null)};
}
const qty=(id=1)=>sqlite.prepare('SELECT stock_qty FROM items WHERE id=?').get(id).stock_qty;
const count=()=>sqlite.prepare('SELECT COUNT(*) AS n FROM stock_transactions').get().n;
const accountingCount=()=>sqlite.prepare('SELECT COUNT(*) AS n FROM accounting_transactions').get().n;
function balanced(reference){const rows=sqlite.prepare('SELECT indicator,SUM(amount_currency) amount FROM accounting_transactions WHERE reference=? GROUP BY indicator').all(reference);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.indicator==='debit').amount,rows.find(row=>row.indicator==='credit').amount)}
function balancedLocal(reference){const rows=sqlite.prepare('SELECT indicator,SUM(amount_local_currency) amount FROM accounting_transactions WHERE reference=? GROUP BY indicator').all(reference);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.indicator==='debit').amount,rows.find(row=>row.indicator==='credit').amount)}
function reconcile(){for(const row of sqlite.prepare('SELECT i.id,i.stock_qty,COALESCE(SUM(t.quantity),0) AS ledger FROM items i LEFT JOIN stock_transactions t ON t.item_id=i.id GROUP BY i.id').all())assert.ok(Math.abs(row.stock_qty-row.ledger)<1e-8,JSON.stringify(row));assert.equal(qty(3),50)}
await Promise.all([stock.ensureStockLedger('default',d1),stock.ensureStockLedger('default',d1)]);
await stock.ensureStockLedger('other',d1);
assert.equal(qty(),20);assert.equal(qty(2),7);reconcile();
const baseline=count();await stock.ensureStockLedger('default',d1);assert.equal(count(),baseline);

let purchase={supplierId:1,purchaseDate:'2026-09-14',currency:'USD',lines:[{itemId:1,description:'Part A',quantity:4,unitCost:10}]};
let response=await call(purchases,'POST',purchase);assert.equal(response.status,201);const id=response.data.purchase.id;
assert.equal(accountingCount(),3);balanced(response.data.purchase.purchaseNumber);
assert.equal(qty(),24);reconcile();
purchase={...purchase,id,lines:[{itemId:1,description:'Part A',quantity:4,unitCost:12}]};
assert.equal((await call(purchases,'PUT',purchase)).status,200);assert.equal(qty(),24);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM accounting_transactions WHERE reference='PUR-000002'").get().n,3);balanced('PUR-000002');
assert.equal(sqlite.prepare("SELECT SUM(quantity*unit_cost) AS n FROM stock_transactions WHERE source_id=? AND transaction_type LIKE 'purchase%'").get(id).n,48);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM stock_transactions WHERE source_id=? AND transaction_type='purchase'").get(id).n,1);
purchase={...purchase,currency:'LBP',lines:[{itemId:2,description:'Part B',quantity:6,unitCost:100}]};
assert.equal((await call(purchases,'PUT',purchase)).status,200);assert.equal(qty(),20);assert.equal(qty(2),13);
assert.equal(sqlite.prepare("SELECT COALESCE(SUM(quantity*unit_cost),0) AS n FROM stock_transactions WHERE source_id=? AND transaction_type LIKE 'purchase%' AND currency='USD'").get(id).n,0);
assert.equal((await call(purchases,'PUT',purchase)).status,200);assert.equal(qty(2),13);reconcile();
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM stock_transactions WHERE source_id=? AND transaction_type='purchase'").get(id).n,1);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM stock_transactions WHERE transaction_type LIKE '%reversal%'").get().n,0);
const beforeInvalid=count();assert.equal((await call(purchases,'PUT',{...purchase,lines:[{itemId:3,description:'Foreign',quantity:2,unitCost:1}]})).status,400);assert.equal(count(),beforeInvalid);
assert.equal((await call(purchases,'GET',null,'other',`?id=${id}`)).status,404);

response=await call(invoices,'POST',{customerId:1,lines:[{lineType:'part',itemId:2,description:'Part B',quantity:2,unitPrice:20},{lineType:'labor',description:'Labor',quantity:3,unitPrice:20}]});
assert.equal(response.status,201);const saleId=response.data.invoice.id;assert.equal(qty(2),11);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM accounting_transactions WHERE reference='INV-000002'").get().n,3);balanced('INV-000002');
const editedSale={id:saleId,customerId:1,mileage:0,taxRate:11,lines:[{lineType:'part',itemId:1,description:'Part A',quantity:5,unitPrice:20}]};
assert.equal((await call(invoices,'PUT',editedSale)).status,200);assert.equal(qty(),15);assert.equal(qty(2),13);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM accounting_transactions WHERE reference='INV-000002'").get().n,3);balanced('INV-000002');
assert.equal((await call(invoices,'PUT',editedSale)).status,200);assert.equal(qty(),15);reconcile();
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM stock_transactions WHERE source_id=? AND transaction_type='sale'").get(saleId).n,1);
const beforePayment=count();assert.equal((await call(invoices,'PUT',{id:saleId,status:'paid'})).status,200);assert.equal(count(),beforePayment);
assert.equal((await call(items,'PUT',{id:1,sku:'A',name:'Part A',stockQty:9,salePrice:20})).status,200);assert.equal(qty(),9);reconcile();
const beforeUnchanged=count();assert.equal((await call(items,'PUT',{id:1,sku:'A',name:'Part A renamed',stockQty:9,salePrice:25})).status,200);assert.equal(count(),beforeUnchanged);
assert.equal((await call(items,'POST',{sku:'NEW',name:'New part',stockQty:8})).status,201);reconcile();
response=await call(ledger,'GET',null,'default','?itemId=1');assert.equal(response.status,200);assert.equal(response.data.transactions[0].balance,9);assert.ok(response.data.transactions.every(row=>row.itemId===1));
response=await call(ledger,'GET',null,'other');assert.ok(response.data.transactions.every(row=>row.itemId===3));
assert.equal((await call(ledger,'GET',null,null)).status,401);
response=await call(salesmenApi,'POST',{code:'REP-1',name:'Representative One',phone:'123'});assert.equal(response.status,201);const salesmanId=response.data.salesman.id;response=await call(customersApi,'POST',{code:'CUS-NEW',name:'Assigned customer',salesmanId});assert.equal(response.status,201);assert.equal(response.data.customer.salesmanId,salesmanId);assert.equal((await call(customersApi,'POST',{code:'CUS-BAD',name:'Wrong company salesman',salesmanId},'other')).status,400);assert.ok((await call(customersApi,'GET',null,'default')).data.customers.every(customer=>customer.salesmanId));

response=await call(journals,'POST',{voucherDate:'2026-09-14',externalReference:'OPEN-1',notes:'Opening entry',lines:[{accountNumber:'1000',description:'Cash',currency:'USD',debit:100,credit:0,localAmount:8950000},{accountNumber:'3000',description:'Capital',currency:'LBP',debit:0,credit:8950000,localAmount:8950000}]});
assert.equal(response.status,201);assert.equal(response.data.voucherNumber,'JV-000001');balancedLocal('JV-000001');
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM accounting_transactions WHERE transaction_type='journal' AND reference='JV-000001'").get().n,2);
assert.deepEqual(sqlite.prepare("SELECT currency,amount_currency amountCurrency,amount_local_currency localAmount FROM accounting_transactions WHERE reference='JV-000001' ORDER BY id").all().map(row=>({...row})),[{currency:'USD',amountCurrency:100,localAmount:8950000},{currency:'LBP',amountCurrency:8950000,localAmount:8950000}]);
response=await call(journals,'GET',null,'default');const postedVoucher=response.data.vouchers.find(voucher=>voucher.reference==='JV-000001');assert.equal(postedVoucher.currency,'Multiple');assert.equal(postedVoucher.debitLocal,postedVoucher.creditLocal);
response=await call(journals,'GET',null,'default','?type=journal&sourceId=1');assert.equal(response.data.voucher.reference,'JV-000001');assert.equal(response.data.lines.length,2);assert.equal(response.data.settings.localCurrency,'LBP');
response=await call(journals,'PUT',{sourceId:1,voucherDate:'2026-09-15',externalReference:'OPEN-EDIT',notes:'Updated opening entry',lines:[{accountNumber:'1000',description:'Cash revised',currency:'USD',debit:200,credit:0,localAmount:17900000},{accountNumber:'3000',description:'Capital revised',currency:'LBP',debit:0,credit:17900000,localAmount:17900000}]});assert.equal(response.status,200);assert.equal(response.data.voucherNumber,'JV-000001');balancedLocal('JV-000001');assert.equal(sqlite.prepare("SELECT MAX(amount_currency) amount FROM accounting_transactions WHERE reference='JV-000001'").get().amount,17900000);assert.equal(sqlite.prepare("SELECT voucher_date date FROM journal_vouchers WHERE id=1").get().date,'2026-09-15');
assert.equal((await call(journals,'PUT',{sourceId:1,voucherDate:'2026-09-16',lines:[{accountNumber:'1000',currency:'USD',debit:50,credit:0,localAmount:4475000},{accountNumber:'3000',currency:'LBP',debit:0,credit:4000000,localAmount:4000000}]})).status,400);assert.equal(sqlite.prepare("SELECT voucher_date date FROM journal_vouchers WHERE id=1").get().date,'2026-09-15');
assert.equal((await call(journals,'PUT',{sourceId:1,voucherDate:'2026-09-16',lines:[{accountNumber:'1000',currency:'USD',debit:50,credit:0,localAmount:4475000},{accountNumber:'3000',currency:'LBP',debit:0,credit:4475000,localAmount:4475000}]},'other')).status,404);
assert.equal((await call(journals,'POST',{voucherDate:'2026-09-14',lines:[{accountNumber:'1000',currency:'USD',debit:100,credit:0,localAmount:8950000},{accountNumber:'3000',currency:'USD',debit:0,credit:100,localAmount:8900000}]})).status,400);
assert.equal((await call(journals,'POST',{voucherDate:'2026-09-14',lines:[{accountNumber:'1000',currency:'USD',debit:100,credit:0,localAmount:8950000},{accountNumber:'9999',currency:'LBP',debit:0,credit:8950000,localAmount:8950000}]})).status,400);
assert.equal((await call(journals,'GET',null,'other')).data.vouchers.some(voucher=>voucher.reference==='JV-000001'),false);
response=await call(trialBalance,'GET',null,'default','?from=2026-09-01&to=2026-09-30');assert.equal(response.status,200);assert.equal(response.data.currency,'LBP');assert.ok(response.data.accounts.length>0);assert.equal(response.data.accounts.reduce((sum,row)=>sum+row.periodDebit,0),response.data.accounts.reduce((sum,row)=>sum+row.periodCredit,0));assert.equal((await call(trialBalance,'GET',null,'default','?from=2026-10-01&to=2026-09-01')).status,400);assert.equal((await call(trialBalance,'GET',null,null,'?from=2026-09-01&to=2026-09-30')).status,401);
response=await call(accountStatement,'GET',null,'default','?accountNumber=1000&from=2026-09-15&to=2026-09-15');assert.equal(response.status,200);assert.equal(response.data.account.name,'Cash');assert.equal(response.data.openingBalance,0);assert.equal(response.data.transactions.length,1);assert.equal(response.data.transactions[0].amountLocalCurrency,17900000);response=await call(accountStatement,'GET',null,'default','?accountNumber=1000&from=2026-09-16&to=2026-09-30');assert.equal(response.data.openingBalance,17900000);assert.equal(response.data.transactions.length,0);assert.equal((await call(accountStatement,'GET',null,'other','?accountNumber=1000&from=2026-09-01&to=2026-09-30')).status,404);assert.equal((await call(accountStatement,'GET',null,null,'?accountNumber=1000&from=2026-09-01&to=2026-09-30')).status,401);

// A constraint failure after removing the old posting proves the whole replacement is rolled back.
const beforeFailure=count();
await assert.rejects(d1.batch([...stock.removeDocumentStock(d1,'purchase',purchase.id===id?'PUR-000002':'invalid','default'),d1.prepare("INSERT INTO items(company_code,sku,name) VALUES('default','A','Duplicate')")]));
assert.equal(count(),beforeFailure);assert.equal(qty(2),13);reconcile();
console.log('Passed actual handlers: purchases, sales, stock, balanced journal vouchers, account validation, local currency conversion, authorization, tenant isolation and rollback.');
