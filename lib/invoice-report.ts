export type ReportInvoice = {
  id:number; invoiceNumber:string; invoiceDate:string; customerId:number; customerName:string; customerCode:string;
  documentState?:string; status:string; currency:string; currencyRate:number; salesmanName?:string; subtotal:number; discountAmount?:number; lineDiscountTotal?:number; tax:number; total:number; creditSubtotal?:number; creditTax?:number; creditedAmount?:number; appliedAmount:number; outstanding:number;
};
export type ReportDetails = {companyName:string; currency:string; customer:string; fromDate:string; toDate:string};
export const paymentStatus=(invoice:ReportInvoice)=>invoice.status==="paid"?"Paid":invoice.status==="partial"||invoice.appliedAmount>0?"Partially paid":"Unpaid";
export const amountDue=(invoice:ReportInvoice)=>Math.max(0,Number(invoice.outstanding||0));
export function reportTotals(invoices:ReportInvoice[]){
 const cents=invoices.reduce((sum,i)=>({subtotal:sum.subtotal+Math.round((i.subtotal-(i.creditSubtotal||0))*100),lineDiscount:sum.lineDiscount+Math.round((i.lineDiscountTotal||0)*100),discount:sum.discount+Math.round((i.discountAmount||0)*100),tax:sum.tax+Math.round((i.tax-(i.creditTax||0))*100),total:sum.total+Math.round((i.total-(i.creditedAmount||0))*100),due:sum.due+Math.round(amountDue(i)*100)}),{subtotal:0,lineDiscount:0,discount:0,tax:0,total:0,due:0});
 return {gross:(cents.subtotal+cents.discount+cents.lineDiscount)/100,lineDiscount:cents.lineDiscount/100,subtotal:cents.subtotal/100,discount:cents.discount/100,tax:cents.tax/100,total:cents.total/100,due:cents.due/100};
}
export async function loadInvoiceReport(signal:AbortSignal):Promise<ReportInvoice[]>{
 const rows:ReportInvoice[]=[];let beforeId:number|null=null;
 do {
  const response=await fetch('/api/invoices?report=1'+(beforeId?'&beforeId='+beforeId:''),{signal});
  const data=await response.json() as {invoices?:ReportInvoice[];nextCursor?:number|null;error?:string};
  if(!response.ok)throw new Error(data.error||'Could not load invoice report');
  if(!Array.isArray(data.invoices))throw new Error('Invalid invoice report response');
  rows.push(...data.invoices);
  if(data.nextCursor && beforeId && data.nextCursor>=beforeId)throw new Error('Could not load the complete invoice report');
  beforeId=data.nextCursor??null;
 }while(beforeId);
 return rows;
}
