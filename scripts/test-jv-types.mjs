import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(fs.realpathSync('node_modules/drizzle-kit/package.json')),{build}=require('esbuild');
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0048')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
db.exec(`INSERT INTO customers(company_code,customer_code,name) VALUES('a','000222','Existing eligible'),('a','CUS-OLD','Existing incompatible');
INSERT INTO customers(company_code,customer_code,name,account_number) VALUES('a','000333','Existing numbered','4111999999');
INSERT INTO accounts(company_code,account_number,name,account_type) VALUES('a','4111999999','Old name','asset');
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator) VALUES('a','sale',3,'2020-01-01','4111999999','USD','OLD',20,20,'debit');`);
const legacySnapshot=Object.fromEntries(['customers','accounts','accounting_transactions'].map(table=>[table,db.prepare('SELECT * FROM '+table).all()]));
db.exec(fs.readFileSync('drizzle/0048_rapid_pyro.sql','utf8'));
for(const [table,rows] of Object.entries(legacySnapshot)){const current=db.prepare('SELECT * FROM '+table).all();for(let i=0;i<rows.length;i++)for(const key of Object.keys(rows[i]))assert.equal(current[i][key],rows[i][key]);}
function prepare(sql){let args=[];const obj={sql,bind(...a){args=a;return obj},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args),success:true}},async run(){return {success:true,meta:db.prepare(sql).run(...args)}},exec(){const stmt=db.prepare(sql);return {results:stmt.all(...args),success:true}}};return obj}
globalThis.__db={prepare,async batch(statements){db.exec('BEGIN');try{const r=statements.map(s=>s.exec());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};globalThis.__auth={companyCode:'a',role:'superadmin'};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jv-types-tests-'));
async function module(file){const outfile=path.join(dir,file.replaceAll('/','_')+'.mjs');await build({absWorkingDir:process.cwd(),tsconfigRaw:{compilerOptions:{}},entryPoints:[path.resolve(file)],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'d1-test',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path.endsWith('/db/auth'))return {path:'auth',namespace:'test'};if(/^(\.\.\/)+db$|^\.\/index$|^\.$/.test(a.path))return {path:'db',namespace:'test'};const target=path.isAbsolute(a.path)?a.path:path.resolve(path.dirname(a.importer),a.path);return {path:target.endsWith('.ts')?target:target+'.ts',namespace:'source'}});b.onLoad({filter:/.*/,namespace:'source'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'ts'}));b.onResolve({filter:/db\/auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^(\.\.\/)+db$|^\.\/index$|^\.$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='auth'?'export const requireUser=async()=>globalThis.__auth;':'export const getRawDb=()=>globalThis.__db;'}))}}]});return import(pathToFileURL(outfile).href)}
const {accountingDatabase}=await module('db/coa-write.ts');globalThis.__db=accountingDatabase(globalThis.__db);

const types=await module('app/api/journal-voucher-types/route.ts'),journals=await module('app/api/journal-vouchers/route.ts'),allocator=await module('db/journal-voucher-types.ts');
const req=(body,method='POST')=>new Request('https://test',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
db.exec("INSERT INTO currencies(company_code,code,name,rate,active) VALUES('a','USD','USD',1,1); INSERT INTO accounts(company_code,account_number,name,account_type) VALUES('a','1000000001','Debit','asset'),('a','2000000001','Credit','liability');");
const create=async(prefix,description=prefix)=>{const response=await types.POST(req({prefix,description}));assert.equal(response.status,201,await response.clone().text());return (await response.json()).type};
const pay=await create('pay','Payments'),rec=await create('REC','Receipts');assert.equal(pay.prefix,'PAY');
assert.equal((await types.POST(req({prefix:'PAY',description:'Duplicate'}))).status,400);
for(const prefix of ['AB','ABCD','A B','a!b'])assert.equal((await types.POST(req({prefix,description:'Invalid'}))).status,400);
assert.equal((await types.PUT(req({...pay,prefix:'NEW'},'PUT'))).status,400);
const body={voucherTypeId:pay.id,voucherDate:'2026-09-23',lines:[{accountNumber:'1000000001',currency:'USD',debit:10,credit:0,localAmount:10},{accountNumber:'2000000001',currency:'USD',debit:0,credit:10,localAmount:10}]};
async function post(input){const response=await journals.POST(req(input));assert.equal(response.status,201,await response.clone().text());return (await response.json()).voucherNumber}
assert.equal(await post(body),'PAY000001');assert.equal(await post(body),'PAY000002');assert.equal(await post({...body,voucherTypeId:rec.id}),'REC000001');
assert.equal(db.prepare("SELECT COUNT(*) n FROM accounting_transactions WHERE reference='PAY000001'").get().n,2);
const id=db.prepare("SELECT id FROM journal_vouchers WHERE voucher_number='PAY000001'").get().id;
let response=await journals.GET(new Request('https://test?type=journal&sourceId='+id));assert.equal((await response.json()).voucher.voucherTypeDescription,'Payments');
response=await journals.PUT(req({...body,sourceId:id,notes:'Edited'},'PUT'));assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).voucherNumber,'PAY000001');
assert.equal((await journals.PUT(req({...body,sourceId:id,voucherTypeId:rec.id},'PUT'))).status,400);
assert.equal((await journals.POST(req({...body,voucherTypeId:0}))).status,400);
assert.equal((await types.PUT(req({...rec,active:false},'PUT'))).status,200);assert.equal((await journals.POST(req({...body,voucherTypeId:rec.id}))).status,400);
db.exec("INSERT INTO journal_vouchers(company_code,voucher_number,voucher_date,currency) VALUES('a','JV-000009','2026-01-01','USD')");
const legacy=await create('JV-','General');assert.equal(await post({...body,voucherTypeId:legacy.id}),'JV-000010');assert.equal(db.prepare("SELECT voucher_type_id FROM journal_vouchers WHERE voucher_number='JV-000009'").get().voucher_type_id,null);
const parallel=await Promise.all(Array.from({length:10},()=>allocator.journalVoucherNumber(globalThis.__db,'a',pay.id)));assert.equal(new Set(parallel.map(x=>x.number)).size,10);assert.deepEqual(parallel.map(x=>x.number).sort(),Array.from({length:10},(_,i)=>'PAY'+String(i+3).padStart(6,'0')));
globalThis.__auth.companyCode='b';assert.equal((await types.GET(new Request('https://test'))).status,200);assert.equal((await (await types.GET(new Request('https://test'))).json()).types.length,0);assert.equal((await types.PUT(req(pay,'PUT'))).status,404);await assert.rejects(()=>allocator.journalVoucherNumber(globalThis.__db,'b',pay.id),/active journal voucher type/);
const other=await create('PAY');assert.equal((await allocator.journalVoucherNumber(globalThis.__db,'b',other.id)).number,'PAY000001');
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
console.log('PASS: JV types validation, prefix uniqueness, independent atomic sequences, company isolation, active-type checks, legacy numbering preservation, voucher detail/edit and balanced accounting entries.');
