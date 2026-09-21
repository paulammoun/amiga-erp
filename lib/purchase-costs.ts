export type PurchaseExpense = { id?:string; category:string; description:string; currency:string; amount:number; rate?:number; localAmount?:number };
export const roundMoney=(value:number)=>Number(value.toFixed(2));

/** Allocate by goods value before tax; retain precision on individual unit costs. */
export function purchaseCosts(lines:{quantity:number;unitCost:number}[], rate:number, expenses:PurchaseExpense[]) {
 const subtotal=roundMoney(lines.reduce((sum,line)=>sum+line.quantity*line.unitCost,0));
 const goodsLocal=roundMoney(subtotal*rate);
 const expensesLocal=roundMoney(expenses.reduce((sum,e)=>sum+roundMoney(e.amount*(e.rate??0)),0));
 const expensePercent=goodsLocal>0?expensesLocal/goodsLocal*100:0;
 return {subtotal,goodsLocal,expensesLocal,expensePercent,landedLocal:roundMoney(goodsLocal+expensesLocal),landedUnitCosts:lines.map(line=>line.unitCost*(1+expensePercent/100))};
}
