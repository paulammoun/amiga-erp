import {warehouseFor} from '../../../db/warehouses';
import {getRawDb} from '../../../db';
import {requireUser} from '../../../db/auth';
import {getWorkshopSettings} from '../../../db/settings';
import {getCurrency,ensureCompanyCurrencies} from '../../../db/currencies';
import {allocateDocumentNumber} from '../../../db/document-numbers';
import {readOrder} from '../../../db/sales-orders';
import {invoiceTotals} from '../../../lib/invoice-totals';
import {requestKey,requestHash} from '../../../lib/request-idempotency';
import {linesFrom,customerFor,completeLines} from '../invoices/route';
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const failure=(e:unknown)=>Response.json({error:e instanceof Error?e.message:'Could not save sales order.'},{status:400});
export async function GET(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{const db=getRawDb(),company=auth.companyCode.toLowerCase(),p=new URL(request.url).searchParams;if(p.has('id')){const data=await readOrder(db,company,Number(p.get('id')));const history=await db.prepare('SELECT action,actor,created_at AS createdAt FROM sales_order_events WHERE order_id=? ORDER BY id DESC').bind(data.order.id).all();return Response.json({...data,history:history.results})}const rows=await db.prepare('SELECT id FROM sales_orders WHERE company_code=? ORDER BY id DESC').bind(company).all<{id:number}>();const orders=[];for(const row of rows.results){const {order,lines}=await readOrder(db,company,row.id);orders.push({...order,reserved:lines.reduce((n,l)=>n+(l.reserved??0),0)})}return Response.json({orders})}catch(e){return failure(e)}}
export async function POST(request:Request){return save(request,false)}
export async function PUT(request:Request){return save(request,true)}
async function save(request:Request,editing:boolean){const auth=await requireUser(request);if(auth instanceof Response)return auth;let key='',hash='',company='';try{
 const body=await request.json() as Record<string,unknown>&{lines:Record<string,unknown>[]},db=getRawDb();company=auth.companyCode.toLowerCase();key=requestKey(body.requestKey);hash=await requestHash({...body,requestKey:undefined});
 if(!editing){const prior=await db.prepare('SELECT id,request_hash AS hash FROM sales_orders WHERE company_code=? AND request_key=?').bind(company,key).first<{id:number;hash:string}>();if(prior)return prior.hash===hash?Response.json({order:{id:prior.id},duplicate:true}):Response.json({error:'Save key already used for other details.'},{status:409})}
 const id=Number(body.id),existing=editing?await readOrder(db,company,id):null;
 if(existing&&(existing.order.revision!==Number(body.revision)||existing.order.state==='cancelled'))throw new Error('Order changed or cancelled. Refresh before editing.');
 if(existing?.invoices.length)throw new Error('Orders with invoice history are locked. You can cancel the remaining quantity.');
 const customer=await customerFor(db,company,Number(body.customerId));if(!customer)throw new Error('Select a customer.');
 const settings=await getWorkshopSettings(company,db),lines=await completeLines(db,company,customer,settings,linesFrom(body),existing?.lines),discountRate=Number(body.discountRate??customer.defaultDiscount),totals=invoiceTotals(lines,discountRate);
 if(!Number.isFinite(discountRate)||discountRate<0||discountRate>100||totals.total>1e12)throw new Error('Check discounts and order total.');
 const orderDate=String(body.orderDate??''),delivery=String(body.expectedDeliveryDate??'');if(!validDate(orderDate)||(delivery&&(!validDate(delivery)||delivery<orderDate)))throw new Error('Enter valid order and delivery dates.');
 const currency=String(body.currency??customer.defaultCurrency).toUpperCase();await ensureCompanyCurrencies(company,db);if(!(await getCurrency(company,currency,db))?.active)throw new Error('Select an active currency.');
 const state=body.state==='confirmed'?'confirmed':'draft';if(existing?.order.state==='confirmed'&&state==='draft')throw new Error('A confirmed order cannot return to draft.');
 if(state==='confirmed'&&(customer.status!=='active'||customer.creditHold||customer.blockInvoices))throw new Error('Customer is on hold or blocked.');
 const number=existing?.order.orderNumber??await allocateDocumentNumber(company,'salesOrder',db),token=crypto.randomUUID(),terms=String(body.paymentTerms??customer.paymentTerms),notes=String(body.notes??'').trim(),po=String(body.purchaseOrderNumber??'').trim();
 const warehouseCode=await warehouseFor(db,company,body.warehouseCode??existing?.order.warehouseCode);
 const values=[warehouseCode,customer.id,customer.name,JSON.stringify(customer),orderDate,delivery,currency,terms,po,notes,discountRate,totals.total,state];
 const statements:D1PreparedStatement[]=existing?[
 db.prepare('INSERT INTO sales_order_guards(token,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM sales_orders WHERE id=? AND company_code=? AND revision=? AND NOT EXISTS(SELECT 1 FROM invoices WHERE sales_order_id=sales_orders.id)) THEN 1 ELSE NULL END)').bind(token,id,company,body.revision),
 db.prepare('UPDATE sales_orders SET warehouse_code=?,customer_id=?,customer_name=?,customer_snapshot=?,order_date=?,expected_delivery_date=?,currency=?,payment_terms=?,purchase_order_number=?,notes=?,discount_rate=?,total=?,state=?,revision=revision+1 WHERE id=? AND company_code=?').bind(...values,id,company),
 db.prepare('DELETE FROM sales_order_lines WHERE order_id=?').bind(id)
 ]:[db.prepare('INSERT INTO sales_orders(warehouse_code,customer_id,customer_name,customer_snapshot,order_date,expected_delivery_date,currency,payment_terms,purchase_order_number,notes,discount_rate,total,state,company_code,order_number,request_key,request_hash,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,company,number,key,hash,auth.username)];
 for(const [i,l] of lines.entries()){const unit=l.unit||'unit';if(!unit||unit.length>30)throw new Error('Enter a unit for every line.');statements.push(db.prepare('INSERT INTO sales_order_lines(order_id,line_type,item_id,description,unit,quantity,unit_price,line_discount_rate,tax_rate,unit_factor) VALUES((SELECT id FROM sales_orders WHERE company_code=? AND order_number=?),?,?,?,?,?,?,?,?,?)').bind(company,number,l.lineType,l.itemId,l.description,unit,l.quantity,l.unitPrice,l.lineDiscountRate,l.taxRate,l.unitFactor))}
 statements.push(db.prepare('INSERT INTO sales_order_events(order_id,action,actor) VALUES((SELECT id FROM sales_orders WHERE company_code=? AND order_number=?),?,?)').bind(company,number,(editing?'Updated':'Created')+' '+state+' order',auth.username));if(existing)statements.push(db.prepare('DELETE FROM sales_order_guards WHERE token=?').bind(token));await db.batch(statements);
 return Response.json({order:await db.prepare('SELECT id FROM sales_orders WHERE company_code=? AND order_number=?').bind(company,number).first()},{status:editing?200:201});
 }catch(e){if(!editing&&company&&key){const prior=await getRawDb().prepare('SELECT id,request_hash AS hash FROM sales_orders WHERE company_code=? AND request_key=?').bind(company,key).first<{id:number;hash:string}>();if(prior?.hash===hash)return Response.json({order:{id:prior.id},duplicate:true})}return failure(e)}}
export async function PATCH(request:Request){const auth=await requireUser(request);if(auth instanceof Response)return auth;try{const b=await request.json() as Record<string,unknown>,db=getRawDb(),company=auth.companyCode.toLowerCase(),data=await readOrder(db,company,Number(b.id)),token=crypto.randomUUID();if(data.order.revision!==Number(b.revision))throw new Error('Order changed. Refresh before continuing.');const statements:D1PreparedStatement[]=[db.prepare('INSERT INTO sales_order_guards(token,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM sales_orders WHERE id=? AND company_code=? AND revision=?) THEN 1 ELSE NULL END)').bind(token,data.order.id,company,b.revision)];
 if(b.action==='cancelDraft'){
 const invoice=await db.prepare("SELECT id FROM invoices WHERE id=? AND sales_order_id=? AND company_code=? AND document_state='draft'").bind(Number(b.invoiceId),data.order.id,company).first();if(!invoice)throw new Error('Only a draft invoice can be cancelled.');
 statements.push(db.prepare("INSERT INTO sales_order_guards(token,valid) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM invoices WHERE id=? AND document_state='draft') THEN 1 ELSE NULL END)").bind(token+'-draft',b.invoiceId),db.prepare("UPDATE invoices SET document_state='cancelled',revision=revision+1,correction_reason='Sales order draft cancelled' WHERE id=? AND document_state='draft'").bind(b.invoiceId),db.prepare('DELETE FROM sales_order_guards WHERE token=?').bind(token+'-draft'));
 }else if(b.action==='cancel'){
 if(data.lines.some(l=>(l.reserved??0)>0))throw new Error('Cancel or post linked draft invoices first.');if(data.order.state==='cancelled'||data.order.status==='Fully Invoiced')throw new Error('There is no remaining order to cancel.');
 statements.push(db.prepare("UPDATE sales_orders SET state='cancelled',revision=revision+1 WHERE id=?").bind(data.order.id));
 }else if(b.action==='confirm'){
 if(data.order.state!=='draft')throw new Error('Only draft orders can be confirmed.');const c=await customerFor(db,company,data.order.customerId);if(!c||c.status!=='active'||c.creditHold||c.blockInvoices)throw new Error('Customer is on hold or blocked.');statements.push(db.prepare("UPDATE sales_orders SET state='confirmed',revision=revision+1 WHERE id=?").bind(data.order.id));
 }else throw new Error('Unknown order action.');
 statements.push(db.prepare('INSERT INTO sales_order_events(order_id,action,actor) VALUES(?,?,?)').bind(data.order.id,b.action==='cancelDraft'?'Cancelled draft invoice '+b.invoiceId:b.action==='cancel'?'Cancelled remaining order quantities':'Confirmed order',auth.username),db.prepare('DELETE FROM sales_order_guards WHERE token=?').bind(token));await db.batch(statements);return Response.json({ok:true});}catch(e){return failure(e)}}
