export async function journalVoucherNumber(db:D1Database,company:string,typeId:number){
 if(!Number.isSafeInteger(typeId)||typeId<1)throw new Error('Select a journal voucher type.');
 const type=await db.prepare('SELECT id,prefix FROM journal_voucher_types WHERE id=? AND company_code=? AND active=1').bind(typeId,company).first<{id:number;prefix:string}>();
 if(!type)throw new Error('Select an active journal voucher type from your company.');
 // A single SQLite upsert allocates each number atomically, including concurrent posts.
 // Scan existing numbers on first use so legacy vouchers with the same prefix are preserved.
 const result=await db.prepare(`INSERT INTO document_sequences(company_code,document_type,last_number)
 VALUES(?,?,(SELECT COALESCE(MAX(CAST(substr(voucher_number,4) AS INTEGER)),0)+1 FROM journal_vouchers WHERE company_code=? AND substr(voucher_number,1,3)=? AND length(voucher_number)>3 AND substr(voucher_number,4) NOT GLOB '*[^0-9]*'))
 ON CONFLICT(company_code,document_type) DO UPDATE SET last_number=document_sequences.last_number+1 RETURNING last_number AS number`).bind(company,'journal:'+type.prefix,company,type.prefix).first<{number:number}>();
 if(!result||!Number.isSafeInteger(result.number)||result.number<1)throw new Error('Could not allocate a journal voucher number.');
 return {type,number:type.prefix+String(result.number).padStart(6,'0')};
}