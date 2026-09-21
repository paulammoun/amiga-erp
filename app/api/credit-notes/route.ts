import {getRawDb} from "../../../db";
import {requireUser} from "../../../db/auth";
import {allocateDocumentNumber} from "../../../db/document-numbers";
import {requestHash,requestKey} from "../../../lib/request-idempotency";

const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value}
type OriginalLine={id:number;lineType:string;itemId:number|null;description:string;quantity:number;lineTotal:number;lineDiscountAmount:number;discountAmount:number;taxRate:number;taxAmount:number};
const savedTotal=(line:OriginalLine)=>round(line.lineTotal-line.lineDiscountAmount-line.discountAmount+line.taxAmount);

export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{const db=getRawDb(),company=auth.companyCode.toLowerCase(),invoiceId=Number(new URL(request.url).searchParams.get("invoiceId")||0);const notes=await db.prepare(`SELECT n.id,n.credit_number AS creditNumber,n.draft_number AS draftNumber,n.document_state AS documentState,n.original_invoice_id AS originalInvoiceId,n.credit_date AS creditDate,n.currency,n.subtotal,n.tax,n.total,n.reason,n.created_by AS createdBy,n.posted_by AS postedBy,n.posted_at AS postedAt,n.revision,i.invoice_number AS invoiceNumber FROM credit_notes n JOIN invoices i ON i.id=n.original_invoice_id WHERE n.company_code=? ${invoiceId?"AND n.original_invoice_id=?":""} ORDER BY n.id DESC`).bind(company,...(invoiceId?[invoiceId]:[])).all();return Response.json({creditNotes:notes.results})}catch(error){console.error(error);return Response.json({error:"Could not load credit notes."},{status:500})}}

export async function POST(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;return Response.json({error:"Use Sales Returns to credit invoice quantities."},{status:410})}
