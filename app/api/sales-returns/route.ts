import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
import {allocateDocumentNumber} from '../../../db/document-numbers';
import {requestHash,requestKey} from '../../../lib/request-idempotency';
import {returnAmounts,money} from '../../../lib/sales-returns';
import {returnSource,reservationFingerprint,reservationFingerprintSql} from '../../../db/sales-returns';

export async function GET(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{const db=getRawDb(),company=auth.companyCode.toLowerCase(),p=new URL(request.url).searchParams,id=Number(p.get('id')),invoiceId=Number(p.get('invoiceId'));
 if(id){const note=await db.prepare(`SELECT n.*,i.invoice_number,i.customer_name,i.seller_company_name,i.seller_company_address FROM credit_notes n JOIN invoices i ON i.id=n.original_invoice_id AND i.company_code=n.company_code WHERE n.id=? AND n.company_code=?`).bind(id,company).first<Record<string,unknown>>();if(!note)return Response.json({error:'Return not found.'},{status:404});const savedLines=(await db.prepare('SELECT * FROM credit_note_lines WHERE credit_note_id=? ORDER BY id').bind(id).all()).results;const source=await returnSource(company,Number(note.original_invoice_id),id,db);return Response.json({note,savedLines,...source})}
 if(invoiceId)return Response.json(await returnSource(company,invoiceId,0,db));
 const notes=(await db.prepare(`SELECT n.*,i.invoice_number,i.customer_name FROM credit_notes n JOIN invoices i ON i.id=n.original_invoice_id AND i.company_code=n.company_code WHERE n.company_code=? ORDER BY n.id DESC`).bind(company).all()).results;
 return Response.json({notes});
 }catch(error){console.error(error);return Response.json({error:error instanceof Error?error.message:'Could not load returns.'},{status:400})}
}

async function save(request:Request,editing:boolean){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
 const b=await request.json() as Record<string,unknown>,db=getRawDb(),company=auth.companyCode.toLowerCase(),id=editing?Number(b.id):0,invoiceId=Number(b.originalInvoiceId),key=requestKey(b.requestKey),hash=await requestHash({...b,requestKey:undefined}),reason=String(b.reason??'').trim(),notes=String(b.notes??'').trim(),date=String(b.returnDate??'');
 if(!Number.isSafeInteger(invoiceId)||invoiceId<1||!reason||reason.length>2000||notes.length>10000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Select an original invoice, valid date and reason.');
 const prior=await db.prepare('SELECT * FROM credit_notes WHERE company_code=? AND request_key=?').bind(company,key).first<Record<string,unknown>>();if(prior)return prior.request_hash===hash?Response.json({note:prior,duplicate:true}):Response.json({error:'This request key was already used.'},{status:409});
 const fingerprint=await reservationFingerprint(company,invoiceId,db);
 const old=editing?await db.prepare('SELECT * FROM credit_notes WHERE id=? AND company_code=?').bind(id,company).first<Record<string,unknown>>():null;
 if(editing&&(!old||old.workflow!=='sales_return'||old.document_state!=='draft'||Number(old.revision)!==Number(b.revision)||Number(old.original_invoice_id)!==invoiceId))return Response.json({error:'Only the latest version of a return draft can be edited.'},{status:409});
 const {invoice,lines}=await returnSource(company,invoiceId,id,db);
 if(invoice.document_state!=='posted'||Number(invoice.customer_id)!==Number(b.customerId))throw new Error('Select a posted invoice belonging to this customer.');
 if(!Number.isFinite(Number(invoice.currency_rate))||Number(invoice.currency_rate)<=0)throw new Error('The original invoice has no valid saved exchange rate.');
 const inputs=Array.isArray(b.lines)?b.lines as Record<string,unknown>[]:[],seen=new Set<number>();
 const selected=inputs.map(input=>{const line=lines.find(l=>l.id===Number(input.originalInvoiceLineId)),qty=Number(input.quantity);if(!line||seen.has(line.id)||!Number.isFinite(qty)||qty<0)throw new Error('Invalid or duplicate return line.');seen.add(line.id);if(qty>line.remaining+1e-9)throw new Error(`Return quantity exceeds availability for ${line.description}. Refresh to include other drafts and returns.`);return {line,qty,...returnAmounts(line,qty)}}).filter(l=>l.qty>0);
 if(!selected.length)throw new Error('Enter at least one positive return quantity.');
 const sum=(field:'subtotal'|'tax'|'total')=>money(selected.reduce((n,l)=>n+l[field],0)),token=crypto.randomUUID(),draft=old?.draft_number??await allocateDocumentNumber(company,'returnDraft',db);
 const statements:D1PreparedStatement[]=[db.prepare(`INSERT INTO sales_return_guards(token,valid) VALUES(?,CASE WHEN ${reservationFingerprintSql}=? AND EXISTS(SELECT 1 FROM invoices WHERE id=? AND company_code=? AND document_state='posted') THEN 1 ELSE NULL END)`).bind(token,company,invoiceId,fingerprint,invoiceId,company)];
 if(editing){statements.push(db.prepare(`UPDATE credit_notes SET credit_date=?,reason=?,notes=?,subtotal=?,tax=?,total=?,request_key=?,request_hash=?,edit_token=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_code=? AND document_state='draft' AND revision=?`).bind(date,reason,notes,sum('subtotal'),sum('tax'),sum('total'),key,hash,token,id,company,Number(b.revision)),db.prepare('DELETE FROM credit_note_lines WHERE credit_note_id=? AND EXISTS(SELECT 1 FROM credit_notes WHERE id=? AND edit_token=?)').bind(id,id,token))}
 else statements.push(db.prepare(`INSERT INTO credit_notes(company_code,credit_number,draft_number,workflow,original_invoice_id,credit_date,customer_id,currency,currency_rate,local_currency,subtotal,tax,total,reason,notes,created_by,request_key,request_hash,edit_token) VALUES(?,?,?,'sales_return',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(company,draft,draft,invoiceId,date,invoice.customer_id,invoice.currency,invoice.currency_rate,invoice.local_currency,sum('subtotal'),sum('tax'),sum('total'),reason,notes,auth.username,key,hash,token));
 statements.push(db.prepare('UPDATE credit_notes SET warehouse_code=? WHERE company_code=? AND edit_token=?').bind(invoice.warehouse_code,company,token));
 for(const l of selected)statements.push(db.prepare(`INSERT INTO credit_note_lines(credit_note_id,original_invoice_line_id,description,quantity_returned,restore_stock,gross_amount,line_discount_amount,invoice_discount_amount,subtotal,tax_rate,tax,total) SELECT id,?,?,?,?,?,?,?,?,?,?,? FROM credit_notes WHERE company_code=? AND edit_token=?`).bind(l.line.id,l.line.description,l.qty,l.line.lineType==='part'?1:0,l.gross,l.lineDiscount,l.invoiceDiscount,l.subtotal,l.line.taxRate,l.tax,l.total,company,token));
 statements.push(db.prepare('DELETE FROM sales_return_guards WHERE token=?').bind(token));await db.batch(statements);
 const note=await db.prepare('SELECT * FROM credit_notes WHERE company_code=? AND edit_token=?').bind(company,token).first();return Response.json({note},{status:editing?200:201});
 }catch(error){console.error(error);const message=error instanceof Error?error.message:'Could not save return.';return Response.json({error:/constraint/i.test(message)?'Availability changed while saving. Refresh and try again.':message},{status:/constraint/i.test(message)?409:400})}
}
export const POST=(request:Request)=>save(request,false);
export const PUT=(request:Request)=>save(request,true);
export async function DELETE(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{const b=await request.json() as {id:number;revision:number;cancel?:boolean},db=getRawDb(),company=auth.companyCode.toLowerCase();const result=await db.prepare(`UPDATE credit_notes SET document_state='cancelled',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_code=? AND document_state='draft' AND workflow='sales_return' AND revision=? RETURNING id`).bind(b.id,company,b.revision).first();if(!result)return Response.json({error:'Only an unchanged draft can be cancelled.'},{status:409});return Response.json({cancelled:true})}catch(error){console.error(error);return Response.json({error:'Could not cancel draft.'},{status:400})}}
