import {getRawDb} from './index';
import type {ReturnLine} from '../lib/sales-returns';
export async function returnSource(company:string,invoiceId:number,excludeId=0,db=getRawDb()){
 const invoice=await db.prepare(`SELECT * FROM invoices WHERE id=? AND company_code=?`).bind(invoiceId,company).first<Record<string,unknown>>();
 if(!invoice)throw new Error('Original invoice not found.');
 const lines=(await db.prepare(`SELECT l.id,l.unit,l.unit_factor AS unitFactor,l.description,l.line_type AS lineType,l.quantity,l.unit_price AS unitPrice,l.line_total AS lineTotal,l.line_discount_amount AS lineDiscountAmount,l.discount_amount AS discountAmount,l.tax_rate AS taxRate,l.tax_amount AS taxAmount,
 COALESCE(SUM(CASE WHEN n.document_state='posted' AND n.workflow='sales_return' THEN c.quantity_returned ELSE 0 END),0) AS returned,
 COALESCE(SUM(CASE WHEN n.document_state='draft' AND n.workflow='sales_return' THEN c.quantity_returned ELSE 0 END),0) AS reserved,
 COALESCE(SUM(CASE WHEN n.workflow='sales_return' THEN c.gross_amount ELSE 0 END),0) AS usedGross,
 COALESCE(SUM(CASE WHEN n.workflow='sales_return' THEN c.line_discount_amount ELSE 0 END),0) AS usedLineDiscount,
 COALESCE(SUM(CASE WHEN n.workflow='sales_return' THEN c.invoice_discount_amount ELSE 0 END),0) AS usedInvoiceDiscount,
 COALESCE(SUM(CASE WHEN n.workflow='sales_return' THEN c.tax ELSE 0 END),0) AS usedTax,
 MAX(CASE WHEN n.workflow='legacy' THEN 1 ELSE 0 END) AS legacyBlocked
 FROM invoice_lines l LEFT JOIN credit_note_lines c ON c.original_invoice_line_id=l.id AND c.credit_note_id<>? AND EXISTS(SELECT 1 FROM credit_notes x WHERE x.id=c.credit_note_id AND x.company_code=? AND x.document_state IN ('draft','posted'))
 LEFT JOIN credit_notes n ON n.id=c.credit_note_id WHERE l.invoice_id=? GROUP BY l.id ORDER BY l.id`).bind(excludeId,company,invoiceId).all<ReturnLine>()).results;
 const unallocated=await db.prepare(`SELECT id FROM credit_notes n WHERE original_invoice_id=? AND company_code=? AND workflow='legacy' AND document_state IN ('draft','posted') AND NOT EXISTS(SELECT 1 FROM credit_note_lines l WHERE l.credit_note_id=n.id) LIMIT 1`).bind(invoiceId,company).first();
 const netSum=lines.reduce((n,l)=>n+l.lineTotal-l.lineDiscountAmount-l.discountAmount,0),taxSum=lines.reduce((n,l)=>n+l.taxAmount,0);
 const unreconciled=Math.abs(netSum-Number(invoice.subtotal))>0.011||Math.abs(taxSum-Number(invoice.tax))>0.011||Math.abs(netSum+taxSum-Number(invoice.total))>0.011;
 for(const line of lines){line.legacyBlocked=Number(line.legacyBlocked||!!unallocated||unreconciled||invoice.document_state!=='posted');line.remaining=line.legacyBlocked?0:Math.max(0,line.quantity-line.returned-line.reserved)}
 return {invoice,lines};
}
// A serialized batch verifies this fingerprint before it changes any reservation.
// Edits, cancellation and posting all change the fingerprint.
export const reservationFingerprintSql=`COALESCE((SELECT group_concat(v,'|') FROM (SELECT n.id||':'||n.revision||':'||n.document_state AS v FROM credit_notes n WHERE n.company_code=? AND n.original_invoice_id=? ORDER BY n.id)),'')`;
export async function reservationFingerprint(company:string,invoiceId:number,db=getRawDb()){
 return (await db.prepare('SELECT '+reservationFingerprintSql+' AS value').bind(company,invoiceId).first<{value:string}>())!.value;
}
