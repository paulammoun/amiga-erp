import {invoiceTotals} from './invoice-totals';
export type OrderLine={unitFactor?:number;id?:number;lineType:'part'|'labor';itemId:number|null;description:string;unit:string;quantity:number;unitPrice:number;lineDiscountRate:number;taxRate:number;invoiced?:number;reserved?:number;consumed?:number;usedDiscount?:number};
export function orderStatus(state:string,lines:OrderLine[]){if(state==='draft')return 'Draft';if(state==='cancelled')return 'Cancelled';if(lines.length&&lines.every(l=>(l.invoiced??0)>=l.quantity-1e-9))return 'Fully Invoiced';return lines.some(l=>(l.invoiced??0)>0)?'Partially Invoiced':'Confirmed'}
export function available(l:OrderLine){return Math.max(0,Number((l.quantity-(l.consumed??0)).toFixed(9)))}
/** Allocate each line's original order-discount budget over its unreserved quantity.
 * The final conversion receives the remaining cents; cancelled drafts return their share.
 * Gross, line discount and VAT still use the invoice's half-up monetary stages.
 */
export function conversion(lines:OrderLine[],rate:number,selections:Array<{id:number;quantity:number}>){
 if(!selections.length||new Set(selections.map(s=>s.id)).size!==selections.length)throw new Error('Select each order line at most once.');
 const whole=invoiceTotals(lines,rate);
 return selections.map(s=>{const index=lines.findIndex(l=>l.id===s.id),line=lines[index];if(!line)throw new Error('Order line not found.');const left=available(line);if(!Number.isFinite(s.quantity)||s.quantity<=0||s.quantity>left+1e-9)throw new Error('Quantity to invoice must be positive and cannot exceed the remaining quantity.');const budget=Math.max(0,Math.round(whole.lines[index].discountAmount*100)-Math.round((line.usedDiscount??0)*100));const discount=Math.abs(s.quantity-left)<1e-9?budget:Math.round(budget*s.quantity/left);return{...line,quantity:s.quantity,orderDiscount:Math.min(discount,Math.round(invoiceTotals([{...line,quantity:s.quantity}],0).subtotal*100))/100}});
}
