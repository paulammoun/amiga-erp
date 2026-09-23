import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(fs.realpathSync('node_modules/drizzle-kit/package.json')),{build}=require('esbuild');
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0048')&&!f.startsWith('0051')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
db.exec(`INSERT INTO customers(company_code,customer_code,name) VALUES('a','000222','Existing eligible'),('a','CUS-OLD','Existing incompatible');
INSERT INTO customers(company_code,customer_code,name,account_number) VALUES('a','000333','Existing numbered','4111999999');
INSERT INTO accounts(company_code,account_number,name,account_type) VALUES('a','4111999999','Old name','asset');
INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator) VALUES('a','sale',3,'2020-01-01','4111999999','USD','OLD',20,20,'debit');`);
const legacySnapshot=Object.fromEntries(['customers','accounts','accounting_transactions'].map(table=>[table,db.prepare('SELECT * FROM '+table).all()]));
db.exec(fs.readFileSync('drizzle/0048_rapid_pyro.sql','utf8'));
for(const [table,rows] of Object.entries(legacySnapshot)){const current=db.prepare('SELECT * FROM '+table).all();for(let i=0;i<rows.length;i++)for(const key of Object.keys(rows[i]))assert.equal(current[i][key],rows[i][key]);}
db.exec("INSERT INTO salesmen(company_code,salesman_code,name) VALUES('migration-test','OLD','Existing salesman')");
const oldSalesman=db.prepare("SELECT * FROM salesmen WHERE company_code='migration-test'").get(),invoiceColumns=db.prepare("PRAGMA table_info(invoices)").all();
db.exec(fs.readFileSync('drizzle/0051_salesman_hierarchy.sql','utf8'));
const migrated=db.prepare("SELECT * FROM salesmen WHERE id=?").get(oldSalesman.id);for(const key of Object.keys(oldSalesman))assert.equal(migrated[key],oldSalesman[key]);assert.equal(migrated.supervisor_id,null);assert.deepEqual(db.prepare("PRAGMA table_info(invoices)").all(),invoiceColumns);
function prepare(sql){let args=[];const obj={sql,bind(...a){args=a;return obj},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args),success:true}},async run(){return {success:true,meta:db.prepare(sql).run(...args)}},exec(){const stmt=db.prepare(sql);return {results:stmt.all(...args),success:true}}};return obj}
globalThis.__db={prepare,async batch(statements){db.exec('BEGIN');try{const r=statements.map(s=>s.exec());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};globalThis.__auth={companyCode:'a',role:'superadmin'};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jv-types-tests-'));
async function module(file){const outfile=path.join(dir,file.replaceAll('/','_')+'.mjs');await build({absWorkingDir:process.cwd(),tsconfigRaw:{compilerOptions:{}},entryPoints:[path.resolve(file)],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'d1-test',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path.endsWith('/db/auth'))return {path:'auth',namespace:'test'};if(/^(\.\.\/)+db$|^\.\/index$|^\.$/.test(a.path))return {path:'db',namespace:'test'};const target=path.isAbsolute(a.path)?a.path:path.resolve(path.dirname(a.importer),a.path);return {path:target.endsWith('.ts')?target:target+'.ts',namespace:'source'}});b.onLoad({filter:/.*/,namespace:'source'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'ts'}));b.onResolve({filter:/db\/auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^(\.\.\/)+db$|^\.\/index$|^\.$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='auth'?'export const requireUser=async()=>globalThis.__auth;':'export const getRawDb=()=>globalThis.__db;'}))}}]});return import(pathToFileURL(outfile).href)}
const {accountingDatabase}=await module('db/coa-write.ts');globalThis.__db=accountingDatabase(globalThis.__db);

const hierarchy=await module('app/api/sales-hierarchy/route.ts'),salesmen=await module('app/api/salesmen/route.ts');
const req=(body)=>new Request('https://test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function save(api,body,method='POST',status=201){const r=await api[method](req(body));assert.equal(r.status,status,await r.clone().text());return r.json()}
const manager=(await save(hierarchy,{kind:'area-manager',code:'AM',name:'Manager'})).record;
const supervisor=(await save(hierarchy,{kind:'supervisor',code:'SP',name:'Supervisor',areaManagerId:manager.id})).record;
await save(hierarchy,{kind:'supervisor',code:'BAD',name:'No manager'},'POST',400);
await save(salesmen,{code:'BAD',name:'No supervisor'},'POST',400);
const salesman=(await save(salesmen,{code:'SM',name:'Salesman',supervisorId:supervisor.id})).salesman;
assert.equal(salesman.supervisorId,supervisor.id);
let listed=await (await salesmen.GET(new Request('https://test'))).json();assert.equal(listed.salesmen.length,1);assert.equal(listed.salesmen[0].code,'SM');
db.exec("INSERT INTO salesmen(company_code,salesman_code,name) VALUES('a','OLD','Legacy')");const legacy=db.prepare("SELECT id FROM salesmen WHERE salesman_code='OLD'").get();
await save(salesmen,{id:legacy.id,code:'OLD',name:'Legacy edited',supervisorId:null},'PUT',200);
await save(salesmen,{id:legacy.id,code:'OLD',name:'Legacy assigned',supervisorId:supervisor.id},'PUT',200);
await save(salesmen,{...salesman,supervisorId:null},'PUT',400);
globalThis.__auth.companyCode='b';
assert.equal((await (await hierarchy.GET(new Request('https://test'))).json()).areaManagers.length,0);
await save(hierarchy,{kind:'supervisor',code:'CROSS',name:'Cross-company',areaManagerId:manager.id},'POST',400);
await save(salesmen,{code:'CROSS',name:'Cross-company',supervisorId:supervisor.id},'POST',400);
await save(hierarchy,{...manager,kind:'area-manager'},'PUT',404);
await save(salesmen,salesman,'PUT',404);
globalThis.__auth.companyCode='a';
await save(hierarchy,{...manager,kind:'area-manager',active:false},'PUT',200);
await save(salesmen,{code:'NEW',name:'Inactive manager',supervisorId:supervisor.id},'POST',400);
await save(salesmen,{...salesman,name:'Existing still editable'},'PUT',200);
await save(hierarchy,{...manager,kind:'area-manager',active:true},'PUT',200);
const second=(await save(hierarchy,{kind:'area-manager',code:'AM2',name:'Second manager'})).record;
await save(hierarchy,{...supervisor,kind:'supervisor',areaManagerId:second.id},'PUT',200);
const result=await (await hierarchy.GET(new Request('https://test'))).json();assert.equal(result.supervisors[0].areaManagerId,second.id);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
console.log('PASS: hierarchy creation and reassignment, required parents, searchable-list data, company isolation, inactive parents, legacy salesmen and salesman-only list.');
