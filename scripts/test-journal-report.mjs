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
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'coa-tests-'));
async function module(file){const outfile=path.join(dir,file.replaceAll('/','_')+'.mjs');await build({absWorkingDir:process.cwd(),tsconfigRaw:{compilerOptions:{}},entryPoints:[path.resolve(file)],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'d1-test',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path.endsWith('/db/auth'))return {path:'auth',namespace:'test'};if(/^(\.\.\/)+db$|^\.\/index$|^\.$/.test(a.path))return {path:'db',namespace:'test'};const target=path.isAbsolute(a.path)?a.path:path.resolve(path.dirname(a.importer),a.path);return {path:target.endsWith('.ts')?target:target+'.ts',namespace:'source'}});b.onLoad({filter:/.*/,namespace:'source'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'ts'}));b.onResolve({filter:/db\/auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^(\.\.\/)+db$|^\.\/index$|^\.$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='auth'?'export const requireUser=async()=>globalThis.__auth;':'export const getRawDb=()=>globalThis.__db;'}))}}]});return import(pathToFileURL(outfile).href)}

const api=await module('app/api/accounting-transactions/route.ts');
db.exec("DELETE FROM accounting_transactions");
const insert=db.prepare("INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
for(let i=1;i<=22;i++)for(const side of ['debit','credit'])insert.run('a','sale',i,'2026-09-19','4111999999','USD','REF-'+i,10,900000,side,'Invoice posting');
insert.run('a','receipt',30,'2026-09-18','4111999999','EUR','MIXED',5,500000,'debit','Cash');
insert.run('a','receipt',30,'2026-09-18','4111999999','USD','MIXED',6,500000,'credit','Bank');
insert.run('b','sale',1,'2026-09-19','4111999999','GBP','SECRET',999,999,'debit','Other company');
insert.run('a','sale',40,'2026-09-17','','USD','',1,1,'debit','Legacy');
insert.run('a','sale',41,'2026-09-17','','USD','',1,1,'credit','Legacy');
const get=async(q='')=>(await api.GET(new Request('https://test/api/accounting-transactions?'+q))).json();
const one=await get(),two=await get('page=2');
assert.equal(one.transactions.length,40);assert.equal(one.hasMore,true);
assert.equal(new Set(one.transactions.map(r=>r.reference)).size,20);
assert.equal(two.hasMore,false);assert.equal(two.transactions.length,8);
assert.ok(!one.transactions.some(r=>r.reference==='SECRET'));
assert.ok(!two.transactions.some(r=>one.transactions.some(a=>a.groupKey===r.groupKey)));
assert.equal(new Set(two.transactions.filter(r=>!r.reference).map(r=>r.groupKey)).size,2);
assert.deepEqual(one.currencies,['EUR','USD']);
assert.equal((await get('reference=MIXED')).transactions.length,2);
assert.equal((await get('currency=EUR&type=receipt&side=debit&notes=Cash&from=2026-09-18&to=2026-09-18&account=Old%20name')).transactions.length,1);
assert.equal((await get('from=2026-09-20')).transactions.length,0);
assert.equal((await api.GET(new Request('https://test/api/accounting-transactions?from=2026-02-30'))).status,400);
assert.equal((await api.GET(new Request('https://test/api/accounting-transactions?from=2026-10-01&to=2026-09-01'))).status,400);
assert.equal((await get("reference=%27%20OR%201%3D1--")).transactions.length,0);
console.log('PASS: whole-reference pagination, mixed currencies, company isolation, blank references, combined filters, account-name lookup, invalid dates, and parameterized search.');
