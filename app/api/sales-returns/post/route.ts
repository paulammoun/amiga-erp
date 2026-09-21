import {getRawDb} from '../../../../db';
import {requireUser} from '../../../../db/auth';
import {allocateDocumentNumber} from '../../../../db/document-numbers';
import {requestHash,requestKey} from '../../../../lib/request-idempotency';
import {returnSource,reservationFingerprint,reservationFingerprintSql} from '../../../../db/sales-returns';
import {money} from '../../../../lib/sales-returns';
import {invoiceOutstandingSql} from '../../../../db/receivables';

export async function POST(request:Request){
 const auth=await requireUser(request);if(auth instanceof Response)return auth;
 try{
 const b=await request.json() as Record<string,unknown>,id=Number(b.id),revision=Number(b.revision),key=requestKey(b.requestKey),hash=await requestHash({...b,requestKey:undefined}),db=getRawDb(),company=auth.companyCode.toLowerCase();
 const note=await db.prepare('SELECT * FROM credit_notes WHERE id=? AND company_code=? AND workflow=\'sales_return\'').bind(id,company).first<Record<string,unknown>>();
 if(!note)return Response.json({error:'Sales return not found.'},{status:404});
 if(note.document_state==='posted'&&note.post_request_key===key&&note.post_request_hash===hash)return Response.json({note,duplicate:true});
 if(note.document_state!=='draft'||Number(note.revision)!==revision)return Response.json({error:'Only an unchanged draft can be posted.'},{status:409});
 const invoiceId=Number(note.original_invoice_id),fingerprint=await reservationFingerprint(company,invoiceId,db),{invoice,lines}=await returnSource(company,invoiceId,id,db);
 if(invoice.document_state!=='posted')throw new Error('Original invoice is no longer eligible.');
 const saved=(await db.prepare('SELECT * FROM credit_note_lines WHERE credit_note_id=?').bind(id).all<Record<string,unknown>>()).results;
 if(!saved.length)throw new Error('A return needs at least one positive quantity.');
 for(const l of saved){const original=lines.find(v=>v.id===l.original_invoice_line_id);if(!original||Number(l.quantity_returned)<=0||Number(l.quantity_returned)>original.remaining+1e-9)throw new Error('Return quantities are no longer eligible. Refresh the draft.')}
 // Reverse the accounts actually used by the original sale, never current settings.
 const ledger=(await db.prepare(`SELECT * FROM accounting_transactions WHERE company_code=? AND transaction_type='sale' AND source_id=? ORDER BY id`).bind(company,invoiceId).all<Record<string,unknown>>()).results;
 const revenue=ledger.find(l=>l.notes==='Sales revenue'),vat=ledger.find(l=>l.notes==='Sales tax'),customer=ledger.find(l=>l.notes==='Customer receivable');
 if(!revenue||!customer||(Number(note.tax)!==0&&!vat))throw new Error('Original sales accounting entries are missing; reconcile this historical invoice before returning it.');
 const previous=await db.prepare("SELECT COALESCE(SUM(subtotal),0) net,COALESCE(SUM(total),0) total,COALESCE(SUM(local_subtotal),0) localNet,COALESCE(SUM(local_total),0) localTotal FROM credit_notes WHERE company_code=? AND original_invoice_id=? AND workflow='sales_return' AND document_state='posted'").bind(company,invoiceId).first<{net:number;total:number;localNet:number;localTotal:number}>();
 const cumulative=(original:number,local:number,used:number,usedLocal:number,amount:number)=>original?money(money(local*(used+amount)/original)-usedLocal):0;
 const localNet=cumulative(Number(invoice.subtotal),Number(revenue.amount_local_currency),previous!.net,previous!.localNet,Number(note.subtotal)),localTotal=cumulative(Number(invoice.total),Number(customer.amount_local_currency),previous!.total,previous!.localTotal,Number(note.total)),localTax=money(localTotal-localNet);
 const number=await allocateDocumentNumber(company,'salesReturn',db),token=crypto.randomUUID();
 const statements:D1PreparedStatement[]=[db.prepare(`INSERT INTO sales_return_guards(token,valid) VALUES(?,CASE WHEN ${reservationFingerprintSql}=? AND EXISTS(SELECT 1 FROM credit_notes WHERE id=? AND company_code=? AND document_state='draft' AND revision=?) THEN 1 ELSE NULL END)`).bind(token,company,invoiceId,fingerprint,id,company,revision),
 db.prepare(`UPDATE credit_notes SET local_subtotal=?,local_tax=?,local_total=?,document_state='posted',credit_number=?,posted_by=?,posted_at=CURRENT_TIMESTAMP,post_request_key=?,post_request_hash=?,edit_token=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_code=? AND document_state='draft' AND revision=?`).bind(localNet,localTax,localTotal,number,auth.username,key,hash,token,id,company,revision)];
 // Stock is restored only against the original issued sale rows. Shared on-hand
 // Returns retain the original warehouse; null historical costs remain unknown.
 for(const l of saved){const original=lines.find(v=>v.id===l.original_invoice_line_id)!;if(original.lineType!=='part')continue;
 const movements=(await db.prepare(`SELECT t.*,MAX(0,-t.quantity-COALESCE((SELECT SUM(r.quantity) FROM stock_transactions r WHERE r.company_code=t.company_code AND r.transaction_type='sales_return' AND r.source_line_id=t.id),0)-COALESCE((SELECT SUM(cl.quantity_returned) FROM credit_note_lines cl JOIN credit_notes n ON n.id=cl.credit_note_id WHERE cl.original_invoice_line_id=t.source_line_id AND n.workflow='legacy' AND n.document_state='posted' AND cl.restore_stock=1),0)) AS available FROM stock_transactions t WHERE t.company_code=? AND t.transaction_type='sale' AND t.source_id=? AND t.source_line_id=? AND t.quantity<0 ORDER BY t.id`).bind(company,invoiceId,original.id).all<Record<string,unknown>>()).results;
 let quantity=Number(l.quantity_returned)*(original.unitFactor??1);for(const movement of movements){const qty=Math.min(quantity,Number(movement.available));if(qty<=0)continue;quantity-=qty;
 statements.push(db.prepare(`INSERT INTO stock_transactions(company_code,item_id,transaction_type,source_id,source_line_id,reference,transaction_date,quantity,unit_cost,unit_sale_price,currency,notes,warehouse_code) VALUES(?,?,'sales_return',?,?,?,?,?,?,?,?,?,?)`).bind(company,movement.item_id,id,movement.id,number,note.credit_date,qty,movement.unit_cost,movement.unit_sale_price,movement.currency,'Return against '+invoice.invoice_number+'; original stock movement '+movement.id,movement.warehouse_code),db.prepare('UPDATE items SET stock_qty=stock_qty+? WHERE id=? AND company_code=?').bind(qty,movement.item_id,company));}
 }
 for(const entry of [{source:revenue,amount:Number(note.subtotal),local:localNet,indicator:'debit',label:'Sales revenue and discount reversal'},{source:vat,amount:Number(note.tax),local:localTax,indicator:'debit',label:'Sales tax reversal'},{source:customer,amount:Number(note.total),local:localTotal,indicator:'credit',label:'Customer receivable credit'}]){
 if(!entry.source)continue;statements.push(db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes) VALUES(?,'credit_note',?,?,?,?,?,?,?,?,?)`).bind(company,id,note.credit_date,entry.source.account_number,note.currency,number,entry.amount,entry.local,entry.indicator,entry.label));}
 statements.push(db.prepare(`INSERT INTO credit_note_applications(company_code,credit_note_id,invoice_id,application_date,amount,amount_credit_currency,request_key,request_hash) SELECT ?,?,?,?,MIN(?,${invoiceOutstandingSql('i.id','i.total')}),MIN(?,${invoiceOutstandingSql('i.id','i.total')}),?,? FROM invoices i WHERE i.id=? AND i.company_code=? AND ${invoiceOutstandingSql('i.id','i.total')}>0 AND ?>0`).bind(company,id,invoiceId,note.credit_date,note.total,note.total,key+':original',hash,invoiceId,company,note.total),db.prepare('DELETE FROM sales_return_guards WHERE token=?').bind(token));
 await db.batch(statements);return Response.json({note:await db.prepare('SELECT * FROM credit_notes WHERE id=? AND company_code=?').bind(id,company).first()});
 }catch(error){console.error(error);const message=error instanceof Error?error.message:'Could not post return.';return Response.json({error:message.includes("COA:")?message.slice(message.indexOf("COA:")):/constraint/i.test(message)?'Another request changed this return or its invoice. Refresh before retrying.':message},{status:/constraint/i.test(message)?409:400})}
}
