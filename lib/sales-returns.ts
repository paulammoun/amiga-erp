export type ReturnLine = {unit?:string;unitFactor?:number;id:number;description:string;lineType:string;quantity:number;unitPrice:number;lineTotal:number;lineDiscountAmount:number;discountAmount:number;taxRate:number;taxAmount:number;returned:number;reserved:number;usedGross:number;usedLineDiscount:number;usedInvoiceDiscount:number;usedTax:number;legacyBlocked:number;remaining:number};
export const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
export const money=(n:number)=>cents(n)/100;
// Allocate the residual saved cents over unreserved quantity. The last quantity
// receives every remaining cent, including invoice-discount and VAT residuals.
export function returnAmounts(line:ReturnLine,qty:number){
 const remaining=line.quantity-line.returned-line.reserved;
 const share=(original:number,used:number)=>remaining>0?Math.round((cents(original)-cents(used))*qty/remaining)/100:0;
 const gross=share(line.lineTotal,line.usedGross),lineDiscount=share(line.lineDiscountAmount,line.usedLineDiscount),invoiceDiscount=share(line.discountAmount,line.usedInvoiceDiscount),tax=share(line.taxAmount,line.usedTax);
 const subtotal=share(money(line.lineTotal-line.lineDiscountAmount-line.discountAmount),money(line.usedGross-line.usedLineDiscount-line.usedInvoiceDiscount));
 return {gross:money(subtotal+lineDiscount+invoiceDiscount),lineDiscount,invoiceDiscount,subtotal,tax,total:money(subtotal+tax)};
}
