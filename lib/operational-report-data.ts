import {definitions,finishReport,round,type Filters,type ReportRow,type Column} from './operational-reports';
type Raw=Record<string,any>;
export type Sources=Record<string,Raw[]>;
const num=(v:unknown)=>Number(v??0);
const str=(v:unknown)=>String(v??'');
const index=(rows:Raw[])=>new Map(rows.map(r=>[num(r.id),r]));
const name=(r:Raw|undefined,code:string)=>r?`${r.name} [${r[code]||r.id}]`:'';
const period=(date:string,f:Filters)=>date>=f.from&&date<=f.to;

export function buildOperationalReport(id:string,s:Sources,f:Filters,defaultCurrency='USD'){
 const warnings=new Set<string>(),items=index(s.items),customers=index(s.customers),suppliers=index(s.suppliers),salesmen=index(s.salesmen),invoices=index(s.invoices),credits=index(s.credits),purchases=index(s.purchases),lines=index(s.lines);
 const customer=(id:unknown)=>name(customers.get(num(id)),'customer_code');
 const supplier=(id:unknown)=>name(suppliers.get(num(id)),'supplier_code');
 const salesman=(id:unknown)=>name(salesmen.get(num(id)),'salesman_code');
 const item=(id:unknown):ReportRow=>{const i=items.get(num(id));let m:Raw={};try{m=JSON.parse(i?.master_json||'{}')}catch{}return {sku:i?.sku??'',item:i?`${i.name} [${i.sku}]`:'Non-item sales',unit:m.baseUnit||'unit',group:m.group||'',subgroup:m.subgroup||'',brand:i?.brand||'',active:i?.active?'Active':'Inactive',_itemId:num(id)}};
 const inv=(i:Raw):ReportRow=>({date:i.invoice_date,reference:i.invoice_number,customer:customer(i.customer_id)||i.customer_name,salesman:salesman(i.salesman_id)||i.salesman_name||'',customerGroup:customers.get(num(i.customer_id))?.customer_group||'',currency:i.currency||'Unspecified',warehouse:i.warehouse_code,_document:'invoice',_documentId:i.id});
 const purchase=(p:Raw):ReportRow=>({date:p.purchase_date,reference:p.purchase_number,externalReference:p.supplier_invoice_number,supplier:supplier(p.supplier_id)||p.supplier_name,currency:p.currency,warehouse:p.warehouse_code,_document:'purchase',_documentId:p.id});
 let rows:ReportRow[]=[],columns:Column[]=[...definitions[id].columns];
 const salesRows=():ReportRow[]=>s.lines.flatMap(l=>{const i=invoices.get(num(l.invoice_id));if(!i)return [];const gross=num(l.line_total),discount=num(l.line_discount_amount)+num(l.discount_amount),net=round(gross-discount);return [{...inv(i),...item(l.item_id),_key:`sale-${l.id}`,soldQty:num(l.quantity)*num(l.unit_factor||1),returnQty:0,netQty:num(l.quantity)*num(l.unit_factor||1),gross,discount,sales:net,returns:0,net,vat:num(l.tax_amount),total:round(net+num(l.tax_amount)),collections:0}]});
 const returnRows=():ReportRow[]=>s.creditLines.flatMap(l=>{const n=credits.get(num(l.credit_note_id)),line=lines.get(num(l.original_invoice_line_id));if(!n)return [];const i=invoices.get(num(n.original_invoice_id));if(!i)return [];return [{...inv(i),...item(line?.item_id),date:n.credit_date,reference:n.credit_number,original:i.invoice_number,_originalId:i.id,_document:'return',_documentId:n.id,_key:`return-${l.id}`,warehouse:n.warehouse_code,currency:n.currency,soldQty:0,returnQty:num(l.quantity_returned)*num(line?.unit_factor||1),netQty:-num(l.quantity_returned)*num(line?.unit_factor||1),gross:0,discount:0,sales:0,returns:num(l.subtotal),net:-num(l.subtotal),vat:-num(l.tax),total:-num(l.total),collections:0}]});
 if(id==='sold-items')rows=[...salesRows(),...returnRows()].filter(r=>num(r._itemId)>0);
 if(id==='returns-report')rows=returnRows().map(r=>({...r,vat:-num(r.vat),total:-num(r.total)}));
 if(id==='purchased-items'){
  rows=s.purchaseLines.map(l=>{const p=purchases.get(num(l.purchase_invoice_id))!;return {...item(l.item_id),...purchase(p),_key:`purchase-${l.id}`,quantity:num(l.quantity)*num(l.unit_factor||1),documentUnit:l.unit,price:num(l.unit_cost),discount:null,net:num(l.line_total),expenses:l.landed_unit_cost===null?null:round((num(l.landed_unit_cost)-num(l.unit_cost))*num(l.quantity)),landed:l.landed_unit_cost===null?null:round(num(l.landed_unit_cost)*num(l.quantity))}});
  warnings.add('Purchase discounts are not stored separately. Allocated expenses = (saved landed unit cost − purchase unit cost) × purchase quantity. Missing landed costs remain unavailable.');
 }
 if(['stock-card','stock-balance','transfers-report','adjustments-report'].includes(id)){
  const stock=s.stock.filter(t=>{if(t.transaction_type==='sale')return invoices.has(num(t.source_id));if(['sales_return','credit_note','sale_reversal'].includes(t.transaction_type))return credits.has(num(t.source_id));return true});
  const moves:ReportRow[]=stock.map(t=>{const i=invoices.get(num(t.source_id)),p=purchases.get(num(t.source_id)),n=credits.get(num(t.source_id));const fragments=str(t.notes).split(' · ');const actor=t.transaction_type==='adjustment'&&fragments.length>=3?fragments.at(-2):t.transaction_type.startsWith('transfer_')&&fragments.length>=4?fragments.at(-2):t.transaction_type==='sale'?(i?.posted_by||i?.created_by):t.transaction_type==='sales_return'?n?.posted_by:'';return {...item(t.item_id),_key:`stock-${t.id}`,_id:t.id,_order:t.id,date:t.transaction_date,type:t.transaction_type,reference:t.reference,warehouse:t.warehouse_code,user:actor||'Not recorded',reason:fragments[0],quantity:num(t.quantity),qtyIn:Math.max(0,num(t.quantity)),qtyOut:Math.max(0,-num(t.quantity)),direction:num(t.quantity)>0?'Increase':'Decrease',party:t.transaction_type==='sale'?customer(i?.customer_id):t.transaction_type==='purchase'?supplier(p?.supplier_id):t.transaction_type==='sales_return'?customer(n?.customer_id):'',_document:t.transaction_type==='sale'?'invoice':t.transaction_type==='purchase'?'purchase':t.transaction_type==='sales_return'?'return':'movement',_documentId:t.source_id??t.id,_created:t.created_at}});
  const missingHistory=s.items.filter(i=>num(i.stock_qty)!==0&&!stock.some(t=>t.item_id===i.id));if(missingHistory.length)warnings.add(`${missingHistory.length} item(s) have a stored quantity but no stock ledger history. Their balances are unavailable until the historical ledger is reconciled.`);
  const unknown=new Map<number,string>();for(const t of stock.filter(t=>!t.transaction_date))unknown.set(num(t.item_id),str(t.created_at).slice(0,10));
  if(unknown.size)warnings.add('Undated legacy opening entries have no historical effective date. Balances before their recorded baseline date are unavailable; later balances include that baseline. No current stock balance is substituted.');
  if(id==='stock-card'){
   const balances=new Map<string,number>(),opening=new Map<string,number>();
   for(const r of moves){const key=JSON.stringify([r._itemId,r.warehouse]),old=balances.get(key)||0;balances.set(key,old+num(r.quantity));if(!r.date||str(r.date)<f.from)opening.set(key,(opening.get(key)||0)+num(r.quantity));const baseline=unknown.get(num(r._itemId));r.opening=baseline&&f.from<baseline?null:opening.get(key)||0;r.balance=baseline&&str(r.date)<baseline?null:balances.get(key)!;}
   rows=moves.filter(r=>r.date&&period(str(r.date),f));
   const keys=new Map(moves.filter(r=>!r.date||str(r.date)<=f.to).map(r=>[JSON.stringify([r._itemId,r.warehouse]),r]));
   rows.unshift(...[...keys].map(([key,r])=>({...item(r._itemId),_key:`opening-${key}`,_order:-1,date:f.from,type:'Opening balance',reference:'',warehouse:r.warehouse,opening:unknown.has(num(r._itemId))&&f.from<unknown.get(num(r._itemId))!?null:opening.get(key)||0,balance:unknown.has(num(r._itemId))&&f.from<unknown.get(num(r._itemId))!?null:opening.get(key)||0,qtyIn:0,qtyOut:0})));
   warnings.add('Running balances are per item and warehouse, ordered by effective date then transaction ID. Movement and reference filters hide rows without changing the underlying balance. Quantities use base units.');
  }
  if(id==='stock-balance'){
   const selected=f.selections.warehouse||[],wh=s.warehouses.filter(w=>!selected.length||selected.includes(w.code));
   columns.splice(4,0,...wh.map(w=>({key:'wh_'+w.code,label:w.name+' ('+w.code+')',numeric:true,sum:true})));
   rows=s.items.map(i=>{const row:ReportRow={...item(i.id),companyQty:0,warehouse:''};const history=moves.filter(t=>t._itemId===i.id&&(!t.date||str(t.date)<=f.to));for(const w of wh)row['wh_'+w.code]=history.filter(t=>t.warehouse===w.code).reduce((a,t)=>a+num(t.quantity),0);row.companyQty=history.reduce((a,t)=>a+num(t.quantity),0);const unknownAsOf=(unknown.has(i.id)&&f.to<unknown.get(i.id)!)||missingHistory.some(x=>x.id===i.id);if(unknownAsOf){row.companyQty=null;for(const w of wh)row['wh_'+w.code]=null;}const filteredQty=wh.reduce((a,w)=>a+num(row['wh_'+w.code]),0);row.stockStatus=unknownAsOf?'Unavailable':filteredQty>0?'Positive':filteredQty<0?'Negative':'Zero';return row});
   warnings.add('Company quantity includes every warehouse; warehouse selection changes the displayed columns and stock-status filter only. Valuation is unavailable because the ledger does not retain a complete historical cost basis for all opening stock and adjustments.');
  }
  if(id==='transfers-report')rows=moves.filter(r=>r.type==='transfer_out').map(r=>{const target=moves.find(t=>t.reference===r.reference&&t._itemId===r._itemId&&t.type==='transfer_in');if(!target||num(target.quantity)!==-num(r.quantity))warnings.add('A transfer has an unmatched ledger leg; investigate the source document.');return {...r,source:r.warehouse,destination:target?.warehouse??'Unmatched',quantity:-num(r.quantity)}});
  if(id==='adjustments-report')rows=moves.filter(r=>r.type==='adjustment');
 }
 if(definitions[id].statement){
  const isCustomer=id==='customer-statement',parties=isCustomer?s.customers:s.suppliers,field=isCustomer?'customer':'supplier';
  const byAccount=new Map<string,Raw[]>();for(const p of parties){if(p.account_number)byAccount.set(p.account_number,[...(byAccount.get(p.account_number)||[]),p]);else warnings.add('Parties without a linked accounting account cannot have a reconciled statement. Assign the correct account first.');}
  const balances=new Map<string,number>(),opening=new Map<string,number>(),seen=new Map<string,ReportRow>();
  for(const t of s.ledger){const owners=byAccount.get(t.account_number);if(!owners)continue;if(owners.length!==1){warnings.add('A shared party account is ambiguous. Its statement is unavailable until each party has a distinct accounting account.');continue}const p=owners[0],key=JSON.stringify([t.account_number,t.currency]);const delta=(t.indicator==='debit'?1:-1)*num(t.amount_currency)*(isCustomer?1:-1);balances.set(key,round((balances.get(key)||0)+delta));if(str(t.transaction_date)<f.from)opening.set(key,round((opening.get(key)||0)+delta));
   const r:ReportRow={_key:`ledger-${t.id}`,_order:t.id,date:t.transaction_date,reference:t.reference,type:t.transaction_type,[field]:isCustomer?customer(p.id):supplier(p.id),account:t.account_number,currency:t.currency,opening:opening.get(key)||0,debit:t.indicator==='debit'?num(t.amount_currency):0,credit:t.indicator==='credit'?num(t.amount_currency):0,balance:balances.get(key)!,_document:t.transaction_type==='sale'?'invoice':t.transaction_type==='purchase'?'purchase':t.transaction_type==='credit_note'?'return':t.transaction_type==='receipt'?'receipt':'ledger',_documentId:t.source_id};if(str(t.transaction_date)<=f.to)seen.set(key,r);if(period(str(t.transaction_date),f))rows.push(r);
  }
  rows.unshift(...[...seen].map(([key,r])=>({...r,_key:'opening-'+key,_order:-1,date:f.from,reference:'',type:'Opening balance',debit:0,credit:0,opening:opening.get(key)||0,balance:opening.get(key)||0})));
  warnings.add('Statements use the currently linked party account. If an account was changed or historical postings are missing, reconcile with the Account Statement before relying on the party balance.');
  warnings.add('Statements reconcile directly to the linked account ledger in each original currency, including dated credits, receipts, payments and journal adjustments. Customer balances are debit-positive; supplier payables are credit-positive. Document filters do not recalculate balances.');
 }
 if(id==='daily-sales'){
  rows=[...s.invoices.map(i=>({...inv(i),_key:`invoice-${i.id}`,sales:num(i.subtotal),returns:0,net:num(i.subtotal),collections:0,paymentMethod:'Not applicable',account:'Not applicable'})),...s.credits.map(n=>({...inv(invoices.get(num(n.original_invoice_id))!),_key:`credit-${n.id}`,date:n.credit_date,reference:n.credit_number,currency:n.currency,_document:'return',_documentId:n.id,sales:0,returns:num(n.subtotal),net:-num(n.subtotal),collections:0,paymentMethod:'Not applicable',account:'Not applicable'})),...s.receipts.map(r=>({_key:`receipt-${r.id}`,date:r.receipt_date,reference:r.receipt_number,customer:customer(r.customer_id),salesman:'Not recorded',currency:r.currency,paymentMethod:r.payment_method,account:r.account_number,sales:0,returns:0,net:0,collections:num(r.amount),_document:'receipt',_documentId:r.id}))];
  warnings.add('Sales and returns exclude VAT; collections are receipt amounts. Payment method and cash/bank filters apply to collections; sales are marked Not applicable. Receipt salesman attribution is not recorded.');
 }
 if(id==='outstanding'){
  const applications=[...s.allocations,...s.advances,...s.creditApplications].filter(a=>str(a.date)<=f.to);
  rows=s.invoices.filter(i=>str(i.invoice_date)<=f.to).map(i=>{const applied=round(applications.filter(a=>a.invoice_id===i.id).reduce((n,a)=>n+num(a.amount),0)),outstanding=round(Math.max(0,num(i.total)-applied));const days=i.due_date?Math.max(0,Math.floor((Date.parse(f.to)-Date.parse(i.due_date))/86400000)):null;return {...inv(i),_key:`due-${i.id}`,due:i.due_date||'Not recorded',originalAmount:num(i.total),applied,outstanding,days,bucket:days===null?'Unknown due date':days===0?'Current':days<=30?'1–30':days<=60?'31–60':days<=90?'61–90':'90+',overdue:days===null?'Unknown':days>0?'Overdue':'Current'}}).filter(r=>r.outstanding>0);
  warnings.add('As-of receipts and credits use saved invoice-currency allocations and their effective dates, including later applications of advances. Payment status is never used as payment history. Missing historical allocations remain outstanding.');
 }
 if(id==='price-cost'){
  for(const i of s.items){let master:Raw={};try{master=JSON.parse(i.master_json)}catch{}const itemSuppliers=(master.itemSuppliers||[]).map((v:Raw)=>supplier(v.supplierId)).filter(Boolean);const costs=s.purchaseLines.filter(l=>l.item_id===i.id).map((l):Raw=>({...l,p:purchases.get(num(l.purchase_invoice_id))!})).sort((a,b)=>str(b.p.purchase_date).localeCompare(str(a.p.purchase_date))||b.id-a.id);const currencies=[...new Set(costs.map(l=>str(l.p.currency)))];if(!currencies.length)currencies.push('Unspecified');const prices=[{name:'Standard',price:i.sale_price},...s.prices.filter(p=>p.item_id===i.id).map(p=>({name:`${p.name} [${p.code}]`,price:p.price}))];
   for(const currency of currencies)for(const price of prices)for(const sup of (itemSuppliers.length?itemSuppliers:['Not assigned'])){const last=costs.find(l=>l.p.currency===currency);rows.push({...item(i.id),supplier:sup,currency,priceList:price.name,selling:null,purchaseCost:last?num(last.unit_cost)/num(last.unit_factor||1):null,landedCost:last?.landed_unit_cost!=null?num(last.landed_unit_cost)/num(last.unit_factor||1):null,costMethod:last?`Latest saved purchase ${last.p.purchase_number} (${last.p.purchase_date}); cost ÷ saved unit factor. Selling price shown separately in company default currency.`:'No saved purchase cost',_selling:num(price.price),_priceCurrency:'default'})}
  }
  warnings.add('Costs are latest saved purchase costs per currency, not stock valuation. Landed costs use saved expense allocation. Selling prices use the company default currency; no current exchange rate is used to convert purchase history.');
 }
 if(['sold-items','returns-report','daily-sales'].includes(id))warnings.add('Posted invoices and their separately dated posted credits are both included, so a later reversal does not erase earlier-period activity. Item reports exclude non-item sales; daily sales includes them.');
 if(['sold-items','returns-report','daily-sales','outstanding'].includes(id)&&s.invoices.some(i=>!i.currency))warnings.add('Legacy documents without a saved currency are shown as Unspecified and never combined with a known currency.');
 let effective=f;if(id==='stock-balance')effective={...f,selections:{...f.selections,warehouse:[]}};
 if(id==='price-cost'){
  const sellingRows:ReportRow[]=[];const seen=new Set<string>();for(const row of rows){if(row.currency===defaultCurrency)row.selling=row._selling;const key=JSON.stringify([row._itemId,row.priceList,row.supplier]);if(!seen.has(key)&&!rows.some(r=>r._itemId===row._itemId&&r.priceList===row.priceList&&r.supplier===row.supplier&&r.currency===defaultCurrency)){sellingRows.push({...row,currency:defaultCurrency,selling:row._selling,purchaseCost:null,landedCost:null,costMethod:'Selling price in company default currency; no purchase cost recorded in this currency.'});seen.add(key)}}rows.push(...sellingRows);
 }
 const result=finishReport(id,rows,effective,columns);result.filters=f;
 if(['sold-items','returns-report','daily-sales'].includes(id)){
  const mismatched=s.invoices.filter(i=>period(str(i.invoice_date),f)&&Math.abs(s.lines.filter(l=>l.invoice_id===i.id).reduce((v,l)=>v+num(l.line_total)-num(l.line_discount_amount)-num(l.discount_amount)+num(l.tax_amount),0)-num(i.total))>0.011);
  const missing=s.credits.filter(n=>period(str(n.credit_date),f)&&Math.abs(s.creditLines.filter(l=>l.credit_note_id===n.id).reduce((v,l)=>v+num(l.total),0)-num(n.total))>0.011);
  if(mismatched.length||missing.length)warnings.add(`Reconciliation required: ${mismatched.length} invoice(s) and ${missing.length} credit(s) have line totals that differ from their saved document totals. Item reports show available saved lines; daily sales uses document totals. Review the source documents.`);
 }
 const masters=s.items.map(i=>item(i.id));
 for(const k of ['item','group','subgroup','brand','active'])if(definitions[id].filters.includes(k))result.options[k]=[...new Set(masters.map(r=>str(r[k])).filter(Boolean))].sort();
 for(const k of ['warehouse','source','destination'])if(definitions[id].filters.includes(k))result.options[k]=s.warehouses.map(w=>w.code).sort();
 if(definitions[id].filters.includes('customer'))result.options.customer=s.customers.map(c=>customer(c.id)).sort();
 if(definitions[id].filters.includes('supplier'))result.options.supplier=[...new Set([...s.suppliers.map(c=>supplier(c.id)),...result.options.supplier])].sort();
 if(definitions[id].filters.includes('salesman'))result.options.salesman=[...new Set([...s.salesmen.map(c=>salesman(c.id)),...result.options.salesman])].sort();
 if(id==='stock-balance')result.options.warehouse=s.warehouses.map(w=>w.code);
 return {...result,warnings:[...warnings]};
}
