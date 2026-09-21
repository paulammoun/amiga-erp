import {getRawDb} from ".";

const definitions={
  salesOrder:{table:"sales_orders",column:"order_number",type:"sales_order",prefix:"SOR-"},
  salesReturn:{table:"credit_notes",column:"credit_number",type:"sales_return",prefix:"SRT-"},
  returnDraft:{table:"credit_notes",column:"draft_number",type:"return_draft",prefix:"SRD-"},
  invoice:{table:"invoices",column:"invoice_number",type:"invoice",prefix:"INV-"},
  receipt:{table:"customer_receipts",column:"receipt_number",type:"receipt",prefix:"RCT-"},
  draft:{table:"invoices",column:"draft_number",type:"draft",prefix:"DRF-"},
  credit:{table:"credit_notes",column:"credit_number",type:"credit",prefix:"CRN-"},
  creditDraft:{table:"credit_notes",column:"draft_number",type:"credit_draft",prefix:"CRD-"},
} as const;

export async function allocateDocumentNumber(companyCode:string,kind:keyof typeof definitions,db:D1Database=getRawDb()){
  const company=companyCode.toLowerCase(),definition=definitions[kind];
  const row=await db.prepare(`INSERT INTO document_sequences(company_code,document_type,last_number)
    VALUES(?,?,(SELECT COALESCE(MAX(CAST(SUBSTR(${definition.column},5) AS INTEGER)),0)+1 FROM ${definition.table} WHERE company_code=? AND ${definition.column} LIKE ?))
    ON CONFLICT(company_code,document_type) DO UPDATE SET last_number=document_sequences.last_number+1
    RETURNING last_number AS number`).bind(company,definition.type,company,definition.prefix+"%").first<{number:number}>();
  if(!row||!Number.isSafeInteger(Number(row.number))||Number(row.number)<1)throw new Error(`Could not allocate the next ${kind} number.`);
  return definition.prefix+String(row.number).padStart(6,"0");
}
