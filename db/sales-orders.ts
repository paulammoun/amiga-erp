import {available,conversion,orderStatus,type OrderLine} from '../lib/sales-orders';
export type Order={warehouseCode:string;id:number;companyCode:string;orderNumber:string;state:string;revision:number;customerId:number;customerName:string;orderDate:string;expectedDeliveryDate:string;currency:string;paymentTerms:string;purchaseOrderNumber:string;notes:string;discountRate:number;total:number;customerSnapshot:string};
export async function readOrder(db:D1Database,company:string,id:number){
 const order=await db.prepare(`SELECT warehouse_code AS warehouseCode,id,company_code AS companyCode,order_number AS orderNumber,state,revision,customer_id AS customerId,customer_name AS customerName,order_date AS orderDate,expected_delivery_date AS expectedDeliveryDate,currency,payment_terms AS paymentTerms,purchase_order_number AS purchaseOrderNumber,notes,discount_rate AS discountRate,total,customer_snapshot AS customerSnapshot FROM sales_orders WHERE id=? AND company_code=?`).bind(id,company).first<Order>();
 if(!order)throw new Error('Sales order not found.');
 const rows=await db.prepare(`SELECT l.id,l.line_type AS lineType,l.item_id AS itemId,l.description,l.unit,l.unit_factor AS unitFactor,l.quantity,l.unit_price AS unitPrice,l.line_discount_rate AS lineDiscountRate,l.tax_rate AS taxRate,
 COALESCE(SUM(CASE WHEN i.document_state='posted' THEN il.quantity ELSE 0 END),0) AS invoiced,
 COALESCE(SUM(CASE WHEN i.document_state='draft' THEN il.quantity ELSE 0 END),0) AS reserved,
 COALESCE(SUM(CASE WHEN i.document_state IN ('draft','posted','reversed') THEN il.quantity ELSE 0 END),0) AS consumed,
 COALESCE(SUM(CASE WHEN i.document_state IN ('draft','posted','reversed') THEN il.discount_amount ELSE 0 END),0) AS usedDiscount
 FROM sales_order_lines l LEFT JOIN invoice_lines il ON il.sales_order_line_id=l.id LEFT JOIN invoices i ON i.id=il.invoice_id WHERE l.order_id=? GROUP BY l.id ORDER BY l.id`).bind(id).all<OrderLine>();
 const lines=rows.results.map(l=>({...l,remaining:available(l)}));
 const linked=await db.prepare(`SELECT id,invoice_number AS invoiceNumber,document_state AS documentState,total,revision,currency FROM invoices WHERE sales_order_id=? AND company_code=? ORDER BY id`).bind(id,company).all();
 return{order:{...order,status:orderStatus(order.state,lines)},lines,invoices:linked.results};
}
export async function prepareConversion(db:D1Database,company:string,body:Record<string,unknown>){
 const data=await readOrder(db,company,Number(body.salesOrderId));
 if(data.order.state!=='confirmed')throw new Error('Only confirmed orders can be invoiced.');
 if(Number(body.orderRevision)!==data.order.revision)throw new Error('The order changed. Refresh before converting.');
 const selections=body.invoiceAllRemaining===true?data.lines.filter(l=>l.remaining>0).map(l=>({id:l.id!,quantity:l.remaining})):Array.isArray(body.orderLines)?body.orderLines.map(v=>({id:Number(v.id),quantity:Number(v.quantity)})):[];
 const lines=conversion(data.lines,data.order.discountRate,selections);
 Object.assign(body,{warehouseCode:data.order.warehouseCode,customerId:data.order.customerId,currency:data.order.currency,paymentTerms:data.order.paymentTerms,purchaseOrderNumber:data.order.purchaseOrderNumber,notes:data.order.notes,discountRate:data.order.discountRate,lines});
 return{...data,selected:lines};
}
