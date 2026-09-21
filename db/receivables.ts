// Initial receipt applications and later applications of their remaining advance both reduce the invoice balance.
export function invoiceAppliedSql(invoiceId:string) {
  return `(COALESCE((SELECT SUM(a.amount) FROM receipt_invoice_allocations a WHERE a.invoice_id=${invoiceId}),0)
    +COALESCE((SELECT SUM(a.amount) FROM customer_advance_applications a WHERE a.invoice_id=${invoiceId}),0)
    +COALESCE((SELECT SUM(a.amount) FROM credit_note_applications a JOIN credit_notes n ON n.id=a.credit_note_id WHERE a.invoice_id=${invoiceId} AND n.document_state='posted'),0))`;
}

export function invoiceOutstandingSql(invoiceId:string,invoiceTotal:string) {
  return `(CASE WHEN (SELECT document_state FROM invoices WHERE id=${invoiceId}) IN ('draft','cancelled') THEN 0 ELSE MAX(ROUND(${invoiceTotal}-${invoiceAppliedSql(invoiceId)},2),0) END)`;
}

export function invoicePaymentStatusSql(invoiceId:string,invoiceTotal:string){
  return `(CASE WHEN ${invoiceOutstandingSql(invoiceId,invoiceTotal)}<=0 THEN 'paid' WHEN ${invoiceAppliedSql(invoiceId)}>0 THEN 'partial' ELSE 'unpaid' END)`;
}

export function receiptAppliedSql(receiptId:string) {
  return `(COALESCE((SELECT SUM(CASE WHEN a.amount_receipt_currency>0 THEN a.amount_receipt_currency ELSE a.amount END) FROM receipt_invoice_allocations a WHERE a.receipt_id=${receiptId}),0)
    +COALESCE((SELECT SUM(CASE WHEN a.amount_receipt_currency>0 THEN a.amount_receipt_currency ELSE a.amount END) FROM customer_advance_applications a WHERE a.receipt_id=${receiptId}),0))`;
}

export function receiptAdvanceSql(receiptId:string,receiptAmount:string) {
  return `MAX(ROUND(${receiptAmount}-${receiptAppliedSql(receiptId)},2),0)`;
}
