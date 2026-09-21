/** All accounting writes pass through this D1 adapter. Validation and ID linking
 * run inside the same batch as the document, so a failed posting rolls it back. */
export function accountingDatabase(raw:D1Database):D1Database{
 const sqlByStatement=new WeakMap<object,string>();
 const wrap=(statement:D1PreparedStatement,sql:string):D1PreparedStatement=>{
  const proxy=new Proxy(statement,{get(target,key){
   if(key==='bind')return (...args:unknown[])=>wrap(target.bind(...args),sql);
   if(['run','all','first'].includes(String(key))&&/\b(?:INSERT\s+INTO|UPDATE)\s+accounting_transactions\b/i.test(sql))return async(...args:unknown[])=>{const result=(await batch([proxy]))[0];if(key==='first'){const row=result.results[0];return args[0]&&row?(row as Record<string,unknown>)[String(args[0])]:row??null}return result};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});sqlByStatement.set(proxy,sql);originals.set(proxy,statement);return proxy;
 };
 const originals=new WeakMap<object,D1PreparedStatement>();
 async function batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>{
  const ledger=statements.some(s=>/\b(?:INSERT\s+INTO|UPDATE)\s+accounting_transactions\b/i.test(sqlByStatement.get(s)??'')),token=crypto.randomUUID();
  const originalsOnly=statements.map(s=>originals.get(s)??s);
  if(!ledger){try{return await raw.batch<T>(originalsOnly)}catch(e){if(String(e).includes('coa_write_guards'))throw new Error('COA: The account configuration or linked record changed. Refresh and review the chart of accounts before retrying.');throw e}}
  const before=raw.prepare("INSERT INTO coa_posting_guards(token,max_id,valid) SELECT ?,COALESCE(MAX(id),0),1 FROM accounting_transactions").bind(token);
  const validate=raw.prepare(`UPDATE coa_posting_guards SET valid=CASE WHEN EXISTS(SELECT 1 FROM accounting_transactions t WHERE t.id>coa_posting_guards.max_id AND NOT EXISTS(SELECT 1 FROM accounts a WHERE a.company_code=t.company_code AND a.account_number=t.account_number AND a.active=1 AND length(a.account_number)=10 AND a.account_number NOT GLOB '*[^0-9]*' AND (t.account_id IS NULL OR t.account_id=a.id))) THEN NULL ELSE 1 END WHERE token=?`).bind(token);
  const link=raw.prepare("UPDATE accounting_transactions SET account_id=(SELECT id FROM accounts a WHERE a.company_code=accounting_transactions.company_code AND a.account_number=accounting_transactions.account_number) WHERE id>(SELECT max_id FROM coa_posting_guards WHERE token=?)").bind(token);
  try{const results=await raw.batch<T>([before,...originalsOnly,validate,link,raw.prepare('DELETE FROM coa_posting_guards WHERE token=?').bind(token)]);return results.slice(1,1+statements.length)}catch(e){if(String(e).includes('coa_posting_guards'))throw new Error('COA: Transactions require an active 10-digit posting account in this company. Review the chart of accounts and account migration report.');throw e}
 }
 return new Proxy(raw,{get(target,key){if(key==='prepare')return(sql:string)=>wrap(target.prepare(sql),sql);if(key==='batch')return batch;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
}
export function accountAssertion(db:D1Database,condition:string,args:unknown[]=[]){
 const token=crypto.randomUUID();return {check:db.prepare(`INSERT INTO coa_write_guards(token,valid) SELECT ?,CASE WHEN (${condition}) THEN 1 ELSE NULL END`).bind(token,...args),clear:db.prepare('DELETE FROM coa_write_guards WHERE token=?').bind(token)};
}
export async function newPartyAccount(db:D1Database,company:string,kind:'customer'|'supplier',code:string,name:string){
 if(!/^[0-9]{6}$/.test(code))throw new Error('COA: Party codes must contain exactly 6 digits, including leading zeros.');
 const settings=await db.prepare(`SELECT ${kind}_account_prefix AS prefix,default_currency AS currency FROM workshop_settings WHERE company_code=?`).bind(company).first<{prefix:string;currency:string}>(),prefix=settings?.prefix??(kind==='customer'?'4111':'4011');
 const number=prefix+code.padStart(6,'0');
 if(!/^[0-9]{4}$/.test(prefix)||!await db.prepare('SELECT id FROM accounts WHERE company_code=? AND account_number=?').bind(company,prefix).first())throw new Error('COA: Create the configured four-digit prefix group in Company Configuration first.');
 if(await db.prepare('SELECT id FROM accounts WHERE company_code=? AND account_number=?').bind(company,number).first())throw new Error(`COA: Generated account ${number} already exists for an unrelated record. It was not linked or changed.`);
 const guard=accountAssertion(db,`EXISTS(SELECT 1 FROM accounts WHERE company_code=? AND account_number=?) AND COALESCE((SELECT ${kind}_account_prefix FROM workshop_settings WHERE company_code=?),?)=?`,[company,prefix,company,prefix,prefix]);
 return {number,before:[guard.check,db.prepare("INSERT INTO accounts(company_code,account_number,name,account_type,currency,active,managed) VALUES(?,?,?,?,?,1,1)").bind(company,number,name,kind==='customer'?'asset':'liability',settings?.currency??'USD')],after:[guard.clear]};
}
