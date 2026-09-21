import { getRawDb } from "./index";

export function removeDocumentAccounting(db:ReturnType<typeof getRawDb>,kind:"sale"|"purchase",reference:string,company:string,guard?:{invoiceId:number;editToken:string}){
 const guardSql=kind==="sale"&&guard?" AND EXISTS(SELECT 1 FROM invoice_edit_guards g WHERE g.invoice_id=? AND g.edit_token=?)":"";
 return [db.prepare(`DELETE FROM accounting_transactions WHERE company_code=? AND transaction_type=? AND reference=?${guardSql}`).bind(company,kind,reference,...(guard?[guard.invoiceId,guard.editToken]:[]))];
}

export function documentAccounting(db:ReturnType<typeof getRawDb>,kind:"sale"|"purchase",reference:string,company:string,countervalues?:{subtotal:number;tax:number;total:number},guard?:{invoiceId:number;editToken:string}){
 const ensureSettings=db.prepare("INSERT INTO workshop_settings(company_code) VALUES(?) ON CONFLICT(company_code) DO NOTHING").bind(company);
 const guardSql=guard?" AND p.id=? AND p.edit_token=?":"";
 const guardBind=guard?[guard.invoiceId,guard.editToken]:[];
 if(kind==="sale")return [ensureSettings,
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'sale',p.id,p.invoice_date,COALESCE((SELECT a.account_number FROM accounts a WHERE a.id=c.account_id AND a.company_code=c.company_code),''),COALESCE(NULLIF(p.currency,''),s.default_currency),p.invoice_number,p.total,COALESCE(?,CASE WHEN COALESCE(NULLIF(p.currency,''),s.default_currency)=s.local_currency THEN p.total ELSE ROUND(p.total*CASE WHEN p.currency_rate>0 THEN p.currency_rate ELSE s.local_currency_rate END,2) END),'debit','Customer receivable'
   FROM invoices p JOIN customers c ON c.id=p.customer_id AND c.company_code=p.company_code JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.invoice_number=? AND p.company_code=?${guardSql}`).bind(countervalues?.total??null,reference,company,...guardBind),
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'sale',p.id,p.invoice_date,s.sales_account_number,COALESCE(NULLIF(p.currency,''),s.default_currency),p.invoice_number,p.subtotal,COALESCE(?,CASE WHEN COALESCE(NULLIF(p.currency,''),s.default_currency)=s.local_currency THEN p.subtotal ELSE ROUND(p.subtotal*CASE WHEN p.currency_rate>0 THEN p.currency_rate ELSE s.local_currency_rate END,2) END),'credit','Sales revenue'
   FROM invoices p JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.invoice_number=? AND p.company_code=?${guardSql}`).bind(countervalues?.subtotal??null,reference,company,...guardBind),
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'sale',p.id,p.invoice_date,s.tax_account_number,COALESCE(NULLIF(p.currency,''),s.default_currency),p.invoice_number,p.tax,COALESCE(?,CASE WHEN COALESCE(NULLIF(p.currency,''),s.default_currency)=s.local_currency THEN p.tax ELSE CASE WHEN p.calculation_version=1 THEN ROUND(ROUND(p.total*CASE WHEN p.currency_rate>0 THEN p.currency_rate ELSE s.local_currency_rate END,2)-ROUND(p.subtotal*CASE WHEN p.currency_rate>0 THEN p.currency_rate ELSE s.local_currency_rate END,2),2) ELSE ROUND(p.tax*CASE WHEN p.currency_rate>0 THEN p.currency_rate ELSE s.local_currency_rate END,2) END END),'credit','Sales tax'
   FROM invoices p JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.invoice_number=? AND p.company_code=? AND p.tax<>0${guardSql}`).bind(countervalues?.tax??null,reference,company,...guardBind)
 ];
 return [ensureSettings,
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'purchase',p.id,p.purchase_date,s.purchase_account_number,p.currency,p.purchase_number,p.subtotal,CASE WHEN p.currency=s.local_currency THEN p.subtotal ELSE ROUND(p.subtotal*COALESCE(p.currency_rate,(SELECT rate FROM currencies WHERE company_code=p.company_code AND code=p.currency),s.local_currency_rate),2) END,'debit','Purchases'
   FROM purchase_invoices p JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.purchase_number=? AND p.company_code=?`).bind(reference,company),
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'purchase',p.id,p.purchase_date,s.purchase_tax_account_number,p.currency,p.purchase_number,p.tax,CASE WHEN p.currency=s.local_currency THEN p.tax ELSE ROUND(p.tax*COALESCE(p.currency_rate,(SELECT rate FROM currencies WHERE company_code=p.company_code AND code=p.currency),s.local_currency_rate),2) END,'debit','Purchase tax'
   FROM purchase_invoices p JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.purchase_number=? AND p.company_code=? AND p.tax<>0`).bind(reference,company),
  db.prepare(`INSERT INTO accounting_transactions(company_code,transaction_type,source_id,transaction_date,account_number,currency,reference,amount_currency,amount_local_currency,indicator,notes)
   SELECT p.company_code,'purchase',p.id,p.purchase_date,COALESCE((SELECT a.account_number FROM accounts a WHERE a.id=sup.account_id AND a.company_code=sup.company_code),''),p.currency,p.purchase_number,p.total,CASE WHEN p.currency=s.local_currency THEN p.total ELSE ROUND(p.total*COALESCE(p.currency_rate,(SELECT rate FROM currencies WHERE company_code=p.company_code AND code=p.currency),s.local_currency_rate),2) END,'credit','Supplier payable'
   FROM purchase_invoices p JOIN suppliers sup ON sup.id=p.supplier_id AND sup.company_code=p.company_code JOIN workshop_settings s ON s.company_code=p.company_code WHERE p.purchase_number=? AND p.company_code=?`).bind(reference,company)
 ];
}
