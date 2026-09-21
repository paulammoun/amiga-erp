import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);

const sqlite = new DatabaseSync(':memory:');
let historical;
const history=()=>['invoices','invoice_lines','stock_transactions','accounting_transactions','items'].map(table=>sqlite.prepare('SELECT * FROM '+table+' WHERE '+(table==='invoice_lines'?'invoice_id=99':table==='invoices'?'id=99':"company_code='legacy'")).all());
for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) {
  if(name === '0033_invoice_discount.sql') {
    sqlite.exec("INSERT INTO customers(id,company_code,name,default_discount) VALUES(99,'legacy','Legacy',15); INSERT INTO invoices(id,company_code,invoice_number,customer_id,subtotal,tax,total) VALUES(99,'legacy','INV-000001',99,90,9.9,99.9);");
  }
  if(name.startsWith('0034_')) {
    sqlite.exec(`UPDATE invoices SET discount_rate=10,discount_amount=10 WHERE id=99;
      INSERT INTO items(id,company_code,sku,name,sale_price,stock_qty) VALUES(99,'legacy','LEGACY','Historical part',100,9);
      INSERT INTO invoice_lines(invoice_id,line_type,item_id,description,quantity,unit_price,line_total,discount_amount,tax_rate,tax_amount) VALUES(99,'part',99,'Historical part',1,100,100,10,11,9.9);
      INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('legacy',99,'opening','Opening','2026-09-01',10),('legacy',99,'sale','INV-000001','2026-09-01',-1);
      INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes) VALUES('legacy','sale',99,'2026-09-01','1100','USD','INV-000001',99.9,8941050,'debit','Historical entry');`);
    historical=history();
  }
  sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
}
assert.deepEqual({...sqlite.prepare('SELECT subtotal,tax,total,discount_rate,discount_amount FROM invoices WHERE id=99').get()}, {subtotal:90,tax:9.9,total:99.9,discount_rate:10,discount_amount:10});
const after=history();
for(let n=0;n<historical.length;n++)for(let i=0;i<historical[n].length;i++)for(const [key,value] of Object.entries(historical[n][i]))assert.equal(after[n][i][key],value,'Historical '+key);
assert.equal(after[0][0].line_discount_total,0);assert.equal(after[0][0].calculation_version,0);assert.equal(after[1][0].line_discount_rate,0);assert.equal(after[1][0].line_discount_amount,0);
sqlite.exec("INSERT INTO workshop_settings(company_code,default_tax,sales_account_number,tax_account_number,default_currency,local_currency,local_currency_rate) VALUES('test',11,'4000','2200','USD','LBP',89500); INSERT INTO customers(id,company_code,name,default_discount,account_number) VALUES(1,'test','Discount customer',10,'1100'),(2,'test','Other customer',20,'1101'); INSERT INTO items(id,company_code,sku,name,sale_price,vat_rate,stock_qty) VALUES(1,'test','A','Part',100,11,100); INSERT INTO stock_transactions(company_code,item_id,transaction_type,reference,transaction_date,quantity) VALUES('test',1,'opening','Opening','2026-09-17',100);");
const db={prepare(sql){return {sql,args:[],bind(...args){return {...this,args}},async first(){return sqlite.prepare(this.sql).get(...this.args)??null},async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}}},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>({...sqlite.prepare(s.sql).run(...s.args),success:true}));sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.discountTestDb=db;
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const load=name=>readFileSync(name,'utf8');
const dbImport='const getRawDb=()=>globalThis.discountTestDb;';
const modules={
 stock:url(load('db/stock.ts').replace(/import .* from "\.\/index";/,dbImport)),
 accounting:url(load('db/accounting.ts').replace(/import .* from "\.\/index";/,dbImport)),
 receivables:url(load('db/receivables.ts')),
 totals:url(load('lib/invoice-totals.ts')),
 sequence:url(load('db/document-numbers.ts').replace(/import .* from "\.";/,dbImport)),
 terms:url(load('lib/payment-terms.ts')),
 idempotency:url(load('lib/request-idempotency.ts')),
 history:url('export const ensureHistoricalInvoiceValues=async()=>{};'),
};
let source=load('app/api/invoices/route.ts').replace(/import .* from "[^"]*db\/sales-orders";/,'');
for(const name of ['stock','accounting','receivables'])source=source.replace(`from "../../../db/${name}"`,`from "${modules[name]}"`);
source=source.replace('from "../../../db/invoice-history"',`from "${modules.history}"`).replace('from "../../../db/document-numbers"',`from "${modules.sequence}"`).replace('from "../../../lib/invoice-totals"',`from "${modules.totals}"`).replace('from "../../../lib/payment-terms"',`from "${modules.terms}"`).replace('from "../../../lib/request-idempotency"',`from "${modules.idempotency}"`).replace(/import .* from "\.\.\/\.\.\/\.\.\/db";/,dbImport).replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/auth";/,'const requireUser=async request=>({companyCode:request.headers.get("company")||"test"});').replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/settings";/,'const getWorkshopSettings=async()=>({defaultTax:11,defaultCurrency:"USD",localCurrency:"LBP",localCurrencyRate:1.2345,companyName:"Test company",companyAddress:"Beirut",sellerTaxRegistration:"MOF-1",logoDataUrl:""});').replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/currencies";/,'const ensureCompanyCurrencies=async()=>{};const getCurrency=async(_company,code)=>({code,rate:1.2345,active:true});');
const api=await import(url(source));
async function call(method,body,query='',company='test'){
 if(body&&method==='POST'&&!body.requestKey)body={...body,requestKey:crypto.randomUUID()};
 if(body&&method==='PUT'&&!body.revision)body={...body,revision:sqlite.prepare('SELECT revision FROM invoices WHERE id=?').get(body.id)?.revision??1};
 const response=await api[method](new Request('http://test/api/invoices'+query,{method,headers:{company,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,data:await response.json()};}

const {invoiceTotals,savedLineTotal,localCountervalues}=await import(modules.totals);
const {reportTotals}=await import(url(load('lib/invoice-report.ts')));
const cents=n=>Math.round(n*100);
const cases=[
 {name:'none',rate:0,lines:[{quantity:2,unitPrice:100,taxRate:11,lineDiscountRate:0}],expected:[200,0,0,200,22,222]},
 {name:'line only',rate:0,lines:[{quantity:2,unitPrice:100,taxRate:11,lineDiscountRate:10}],expected:[200,20,0,180,19.8,199.8]},
 {name:'invoice only',rate:10,lines:[{quantity:2,unitPrice:100,taxRate:11,lineDiscountRate:0}],expected:[200,0,20,180,19.8,199.8]},
 {name:'both',rate:10,lines:[{quantity:2,unitPrice:100,taxRate:11,lineDiscountRate:20}],expected:[200,40,16,144,15.84,159.84]},
 {name:'mixed VAT and fractional quantities',rate:5,lines:[{quantity:1.25,unitPrice:19.99,taxRate:11,lineDiscountRate:10},{quantity:2.5,unitPrice:4.2,taxRate:5,lineDiscountRate:20},{quantity:.125,unitPrice:80,taxRate:0,lineDiscountRate:0}],expected:[45.49,4.6,2.04,38.85,2.75,41.6]},
 {name:'100 percent line discount',rate:10,lines:[{quantity:1,unitPrice:100,taxRate:11,lineDiscountRate:100}],expected:[100,100,0,0,0,0]},
 {name:'100 percent invoice discount',rate:100,lines:[{quantity:1,unitPrice:100,taxRate:11,lineDiscountRate:10}],expected:[100,10,90,0,0,0]},
 {name:'half-cent gross',rate:0,lines:[{quantity:1,unitPrice:1.005,taxRate:0,lineDiscountRate:0}],expected:[1.01,0,0,1.01,0,1.01]},
 {name:'rounding allocation',rate:50,lines:[{quantity:1,unitPrice:.01,taxRate:11,lineDiscountRate:0},{quantity:1,unitPrice:.01,taxRate:5,lineDiscountRate:0},{quantity:1,unitPrice:.01,taxRate:0,lineDiscountRate:0}],expected:[.03,0,.02,.01,0,.01]},
];
const printSource=ts.transpileModule(load('app/invoice-print/page.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function renderInvoice(data){
 const exports={};
 const dependencies={react:{...React,useEffect:()=>{},useState:value=>[value===null?data:value,()=>{}]},'./print.css':{},'@/lib/invoice-totals':{savedLineTotal,localCountervalues}};
 new Function('require','exports',printSource)(name=>dependencies[name]??require(name),exports);
 return renderToStaticMarkup(React.createElement(exports.default));
}
async function verifySaved(id,expected){
 const saved=(await call('GET',null,'?id='+id)).data;
 assert.deepEqual([saved.invoice.subtotal,saved.invoice.lineDiscountTotal,saved.invoice.discountAmount,saved.invoice.tax,saved.invoice.total],[expected.subtotal,expected.lineDiscountTotal,expected.discountAmount,expected.tax,expected.total]);
 assert.equal(cents(saved.lines.reduce((sum,line)=>sum+savedLineTotal(line),0)),cents(saved.invoice.total));
 assert.equal(cents(saved.lines.reduce((sum,line)=>sum+line.discountAmount,0)),cents(saved.invoice.discountAmount));
 assert.equal(cents(saved.lines.reduce((sum,line)=>sum+line.lineDiscountAmount,0)),cents(saved.invoice.lineDiscountTotal));
 const printed=renderInvoice({...saved,settings:{...saved.settings,companyName:'Test company'}});
 const usd=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 for(const label of ['Gross subtotal','Line discounts','Additional invoice discount','Net before VAT','VAT','Total incl. VAT'])assert.ok(printed.includes(label),label);
 for(const value of [expected.grossSubtotal,expected.lineDiscountTotal,expected.discountAmount,expected.subtotal,expected.tax,expected.total])assert.ok(printed.includes(usd(value)),usd(value));
 for(const line of expected.lines)assert.ok(printed.includes(usd(line.total)),usd(line.total));
 const report=(await call('GET',null,'?report=1')).data.invoices.find(i=>i.id===id);
 assert.equal(report.total,saved.invoice.total);assert.equal(report.lineDiscountTotal,saved.invoice.lineDiscountTotal);
 const summary=reportTotals([report]);assert.equal(summary.gross,expected.grossSubtotal);assert.equal(summary.total,expected.total);
 const ledger=sqlite.prepare("SELECT * FROM accounting_transactions WHERE source_id=? AND transaction_type='sale'").all(id);
 const local=localCountervalues(saved.invoice,1.2345);
 for(const [note,key] of [['Customer receivable','total'],['Sales revenue','subtotal'],['Sales tax','tax']]){
  const row=ledger.find(r=>r.notes===note);if(key==='tax'&&!expected.tax){assert.equal(row,undefined);continue;}
  assert.equal(row.amount_currency,expected[key],note+' currency');assert.equal(row.amount_local_currency,local[key],note+' local '+JSON.stringify({local,invoice:saved.invoice}));
 }
 assert.equal(ledger.reduce((sum,row)=>sum+(row.indicator==='debit'?1:-1)*cents(row.amount_currency),0),0);
 assert.equal(ledger.reduce((sum,row)=>sum+(row.indicator==='debit'?1:-1)*cents(row.amount_local_currency),0),0);
 return saved;
}
for(const test of cases){
 const expected=invoiceTotals(test.lines,test.rate);
 assert.deepEqual([expected.grossSubtotal,expected.lineDiscountTotal,expected.discountAmount,expected.subtotal,expected.tax,expected.total],test.expected,test.name);
 const body={customerId:1,invoiceDate:'2026-09-17',discountRate:test.rate,lines:test.lines.map(l=>({...l,lineType:'labor',description:test.name}))};
 const created=await call('POST',body);assert.equal(created.status,201,JSON.stringify(created));
 const id=created.data.invoice.id;await verifySaved(id,expected);
 assert.equal((await call('PUT',{...body,id})).status,409);await verifySaved(id,expected);
 console.log('Passed:',test.name);
}
const base={customerId:1,invoiceDate:'2026-09-17',discountRate:0,lines:[{lineType:'labor',description:'Validation',quantity:1,unitPrice:100,taxRate:11,lineDiscountRate:0}]};
const target=(await call('POST',base)).data.invoice.id;
for(const field of ['lineDiscountRate','taxRate','unitPrice','quantity'])for(const value of [-1,'bad',...(field==='quantity'?[0,1e20]:field==='unitPrice'?[1e20]:[100.01])]){
 const body={...base,id:target,lines:[{...base.lines[0],[field]:value}]};
 assert.equal((await call('POST',body)).status,400,field+' '+value+' POST');
}
for(const lines of [null,{},[null],[],[{...base.lines[0],description:''}]])assert.equal((await call('POST',{...base,id:target,lines})).status,400);
// Item master defaults, explicit override, customer price lists and VAT behavior.
sqlite.exec("UPDATE items SET discount_rate=15 WHERE id=1; INSERT INTO price_lists(id,company_code,code,name) VALUES(1,'test','TRADE','Trade'); INSERT INTO price_list_items(price_list_id,item_id,price) VALUES(1,1,80); UPDATE customers SET price_list_id=1 WHERE id=1;");
const itemBody={customerId:1,invoiceDate:'2026-09-17',lines:[{lineType:'part',itemId:1,description:'Part',quantity:1.25,unitPrice:100}]};
const created=await call('POST',itemBody);assert.equal(created.status,201,JSON.stringify(created));
let saved=(await call('GET',null,'?id='+created.data.invoice.id)).data;
assert.equal(saved.lines[0].unitPrice,100);assert.equal(saved.lines[0].lineDiscountRate,15);assert.equal(saved.invoice.discountRate,10);assert.equal(saved.lines[0].taxRate,11);
const stockBefore=sqlite.prepare('SELECT stock_qty FROM items WHERE id=1').get().stock_qty;
const changed=await call('PUT',{...itemBody,id:created.data.invoice.id,discountRate:50,lines:saved.lines.map(l=>({...l,lineDiscountRate:80}))});assert.equal(changed.status,409,JSON.stringify(changed));
assert.equal(sqlite.prepare('SELECT stock_qty FROM items WHERE id=1').get().stock_qty,stockBefore);
assert.equal(sqlite.prepare("SELECT SUM(quantity) qty FROM stock_transactions WHERE source_id=? AND transaction_type='sale'").get(created.data.invoice.id).qty,-1.25);
sqlite.exec("UPDATE customers SET vat_treatment='exempt' WHERE id=1");
const exempt=await call('POST',{...itemBody,discountRate:0,lines:[{...itemBody.lines[0],lineDiscountRate:0}]});
saved=(await call('GET',null,'?id='+exempt.data.invoice.id)).data;assert.equal(saved.invoice.tax,0);assert.equal(saved.lines[0].lineDiscountRate,0);
// Item API persists its discount and rejects invalid percentages.
let itemSource=load('app/api/items/route.ts').replace('from "../../../db/stock"',`from "${modules.stock}"`).replace(/import .* from "\.\.\/\.\.\/\.\.\/db";/,dbImport).replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/auth";/,'const requireUser=async()=>({companyCode:"test"});').replace(/import .* from "\.\.\/\.\.\/\.\.\/db\/settings";/,'const getWorkshopSettings=async()=>({defaultTax:11});');
const itemsApi=await import(url(itemSource));
for(const discountRate of [-1,101,'bad'])assert.equal((await itemsApi.POST(new Request('http://test/api/items',{method:'POST',body:JSON.stringify({sku:'NEW',name:'New',discountRate})}))).status,400);
const itemResponse=await itemsApi.POST(new Request('http://test/api/items',{method:'POST',body:JSON.stringify({sku:'NEW',name:'New',discountRate:12.5})}));assert.equal(itemResponse.status,201);assert.equal((await itemResponse.json()).item.discountRate,12.5);
// Many small lines and rates: every allocated cent reconciles and allocation is deterministic.
for(let i=0;i<100;i++){
 const lines=Array.from({length:17},(_,j)=>({quantity:(j+1)/7,unitPrice:(i+3)/13,lineDiscountRate:(i*j)%101,taxRate:[0,5,11][j%3]}));
 const value=invoiceTotals(lines,(i*3)%101);assert.deepEqual(invoiceTotals(lines,(i*3)%101),value);
 for(const [lineKey,totalKey] of [['lineTotal','grossSubtotal'],['lineDiscountAmount','lineDiscountTotal'],['discountAmount','discountAmount'],['netAmount','subtotal'],['taxAmount','tax'],['total','total']])assert.equal(value.lines.reduce((sum,l)=>sum+cents(l[lineKey]),0),cents(value[totalKey]));
 assert.ok(value.lines.every(l=>l.netAmount>=0));
}
assert.deepEqual(history(),after,'No historical repost or recalculation during new invoice operations');

// Stage 2: derived payment status and allocation guards.
const paymentTarget=(await call('POST',{...base,requestKey:'stage2-payment-target'})).data.invoice.id;
sqlite.exec("INSERT INTO customer_receipts(company_code,receipt_number,customer_id,receipt_date,amount,currency,currency_rate,invoice_currency_amount,account_number,payment_method,request_key,request_hash) VALUES('test','RCT-900001',1,'2026-09-17',111,'USD',1.2345,111,'1000','cash','stage2-receipt-1','hash');");
const paymentReceipt=sqlite.prepare("SELECT id FROM customer_receipts WHERE receipt_number='RCT-900001'").get().id;
sqlite.prepare("INSERT INTO receipt_invoice_allocations(company_code,receipt_id,invoice_id,amount,amount_receipt_currency) VALUES('test',?,?,?,?)").run(paymentReceipt,paymentTarget,50,50);
let paymentView=(await call('GET',null,'?id='+paymentTarget)).data.invoice;
assert.equal(paymentView.status,'partial');assert.equal(paymentView.appliedAmount,50);assert.equal(paymentView.outstanding,61);
sqlite.prepare("INSERT INTO customer_advance_applications(company_code,receipt_id,invoice_id,amount,amount_receipt_currency,application_date,request_key,request_hash) VALUES('test',?,?,?,?,'2026-09-17','stage2-advance-1','hash')").run(paymentReceipt,paymentTarget,61,61);
paymentView=(await call('GET',null,'?id='+paymentTarget)).data.invoice;
assert.equal(paymentView.status,'paid');assert.equal(paymentView.appliedAmount,111);assert.equal(paymentView.outstanding,0);
const guardApi=await import(url(load('db/allocation-guards.ts')));
await assert.rejects(()=>db.batch([guardApi.guardedAdvanceApplication(db,'test',{receiptId:paymentReceipt,invoiceId:paymentTarget,applicationDate:'2026-09-17',amount:1,amountReceiptCurrency:1,requestKey:'stage2-overallocation',requestHash:'hash'})]),/NOT NULL/);

// Duplicate requests replay one result, and posted documents reject direct edits.
const duplicateBody={...base,requestKey:'stage2-duplicate-request'};
const duplicateFirst=await call('POST',duplicateBody),duplicateSecond=await call('POST',duplicateBody);
assert.equal(duplicateFirst.status,201);assert.equal(duplicateSecond.status,200);assert.equal(duplicateSecond.data.duplicate,true);assert.equal(duplicateSecond.data.invoice.id,duplicateFirst.data.invoice.id);
assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM invoices WHERE request_key='stage2-duplicate-request'").get().count,1);
const editable=(await call('GET',null,'?id='+duplicateFirst.data.invoice.id)).data.invoice;
const editBody={...base,id:editable.id,revision:editable.revision,notes:'first edit'};
assert.equal((await call('PUT',editBody)).status,409);

// Saved snapshots remain stable after master-data and rate changes.
const snapshotId=(await call('POST',{...base,paymentTerms:'net_30',requestKey:'stage2-snapshot'})).data.invoice.id;
let snapshot=(await call('GET',null,'?id='+snapshotId)).data;
assert.equal(snapshot.invoice.dueDate,'2026-10-17');assert.equal(snapshot.customer.name,'Discount customer');assert.equal(snapshot.settings.companyName,'Test company');assert.equal(snapshot.invoice.currencyRate,1.2345);
sqlite.exec("UPDATE customers SET name='Renamed customer' WHERE id=1; UPDATE workshop_settings SET company_name='Renamed seller',local_currency_rate=999 WHERE company_code='test';");
snapshot=(await call('GET',null,'?id='+snapshotId)).data;
assert.equal(snapshot.customer.name,'Discount customer');assert.equal(snapshot.settings.companyName,'Test company');assert.equal(snapshot.invoice.currencyRate,1.2345);

// Customer controls, credit-limit confirmation, and the atomic cash-sale path.
sqlite.exec("INSERT OR IGNORE INTO accounts(company_code,account_number,name,account_type,currency,active) VALUES('test','1100','Receivable','asset','USD',1),('test','1000','Cash','asset','USD',1); UPDATE customers SET name='Discount customer',allow_credit_sales=0 WHERE id=1;");
assert.equal((await call('POST',{...base,requestKey:'stage2-credit-disabled'})).status,409);
const cashSale=await call('POST',{...base,requestKey:'stage2-cash-sale',receivePayment:{accountNumber:'1000',paymentMethod:'cash',reference:'CASH'}});
assert.equal(cashSale.status,201,JSON.stringify(cashSale));
const cashView=(await call('GET',null,'?id='+cashSale.data.invoice.id)).data.invoice;
assert.equal(cashView.status,'paid');assert.equal(cashView.outstanding,0);
assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM customer_receipts WHERE request_key='stage2-cash-sale:payment'").get().count,1);
sqlite.exec("UPDATE customers SET allow_credit_sales=1,warn_credit_limit=1,credit_limit=1 WHERE id=1;");
const warned=await call('POST',{...base,requestKey:'stage2-credit-warning'});assert.equal(warned.status,409);assert.equal(warned.data.requiresConfirmation,true);
assert.equal((await call('POST',{...base,requestKey:'stage2-credit-warning-confirmed',creditLimitConfirmed:true})).status,201);
sqlite.exec("UPDATE customers SET warn_credit_limit=0,credit_hold=1 WHERE id=1;");
assert.equal((await call('POST',{...base,requestKey:'stage2-hold'})).status,409);sqlite.exec("UPDATE customers SET credit_hold=0 WHERE id=1;");

// Legacy paid history is retained in a reconciliation record while financial and stock history stays untouched.
sqlite.exec("UPDATE invoices SET status='paid',snapshot_version=0 WHERE id=99");
const legacyFinancial={invoice:sqlite.prepare('SELECT subtotal,tax,total,discount_rate,discount_amount FROM invoices WHERE id=99').get(),stock:sqlite.prepare("SELECT SUM(quantity) quantity FROM stock_transactions WHERE company_code='legacy'").get(),accounting:sqlite.prepare("SELECT COUNT(*) count,SUM(amount_local_currency) amount FROM accounting_transactions WHERE company_code='legacy'").get()};
let historySource=load('db/invoice-history.ts').replace(/import .* from "\.";/,dbImport).replace('from "./receivables"',`from "${modules.receivables}"`);
const historyApi=await import(url(historySource));await historyApi.ensureHistoricalInvoiceValues('legacy',db);
assert.equal(sqlite.prepare('SELECT snapshot_version FROM invoices WHERE id=99').get().snapshot_version,1);assert.equal(sqlite.prepare('SELECT status FROM invoices WHERE id=99').get().status,'paid');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM payment_status_reconciliations WHERE invoice_id=99 AND legacy_status=\'paid\' AND calculated_status=\'unpaid\'').get().count,1);
assert.deepEqual({invoice:sqlite.prepare('SELECT subtotal,tax,total,discount_rate,discount_amount FROM invoices WHERE id=99').get(),stock:sqlite.prepare("SELECT SUM(quantity) quantity FROM stock_transactions WHERE company_code='legacy'").get(),accounting:sqlite.prepare("SELECT COUNT(*) count,SUM(amount_local_currency) amount FROM accounting_transactions WHERE company_code='legacy'").get()},legacyFinancial);

console.log('Passed Stage 1 calculations plus Stage 2 payment derivation, allocation limits, duplicate protection, numbering, posted-document protection, historical snapshots, customer controls, cash sales and reconciliation preservation.');
