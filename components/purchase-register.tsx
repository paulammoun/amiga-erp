"use client";

import {WarehouseSelect} from './warehouses';
import {Tabs,TabsList,TabsTrigger,TabsContent} from './ui/tabs';
import {ExpenseCategoryDialog} from './expense-category-master';
import type {ItemMaster} from '../lib/item-master';
import ItemPicker,{UnitSelect} from './item-picker';
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, PackageCheck, Plus, Search, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { WorkshopSettings } from "../db/settings";
import type { Supplier } from "./supplier-register";
import type {Currency} from "./currency-register";
import {purchaseCosts,type PurchaseExpense} from '../lib/purchase-costs';

type Item = ItemMaster & { id:number; sku:string; name:string; brand:string; salePrice:number; stockQty:number };
type Purchase = { warehouseCode:string; id:number; purchaseNumber:string; supplierName:string; supplierInvoiceNumber:string; purchaseDate:string; currency:string; subtotal:number; tax:number; total:number; totalLbp:number|null; notes:string; lineCount:number };
type Line = { unit?:string;unitFactor?:number; itemId:number; description:string; quantity:number; unitCost:number };
type Form = { warehouseCode:string; supplierId:number; supplierInvoiceNumber:string; purchaseDate:string; currency:string; currencyRate?:number;lbpRate?:number|null;taxOverride?:number|null;localCurrency?:string;taxRate:number; notes:string; lines:Line[];expenses:PurchaseExpense[] };

const today=()=>{const date=new Date(),offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,10)};
const blankLine=():Line=>({itemId:0,description:"",quantity:1,unitCost:0});
const blankForm=(currency:string,taxRate:number):Form=>({warehouseCode:'MAIN',supplierId:0,supplierInvoiceNumber:"",purchaseDate:today(),currency,taxRate,taxOverride:null,notes:"",lines:[blankLine()],expenses:[]});
const money=(amount:number,currency:string)=>{try{return new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amount)}catch{return `${amount.toFixed(2)} ${currency}`}};

export default function PurchaseRegister({items,suppliers,settings,currencies:providedCurrencies=[],onStockChanged}:{items:Item[];suppliers:Supplier[];settings:WorkshopSettings;currencies?:Currency[];onStockChanged:()=>void}){
 const [purchaseTab,setPurchaseTab]=useState('items');
 const [categoryOpen,setCategoryOpen]=useState(false);
 const [categoryLine,setCategoryLine]=useState<number|null>(null);
 const dialogRef=useRef<HTMLDivElement>(null);
 const [editingId,setEditingId]=useState<number|null>(null);
 const [openingId,setOpeningId]=useState<number|null>(null);
 const [purchases,setPurchases]=useState<Purchase[]>([]);
 const [currencies,setCurrencies]=useState<Currency[]>(providedCurrencies);
 const [categories,setCategories]=useState<{id:number;name:string;active:boolean}[]>([]);
 const [savedRate,setSavedRate]=useState<{currency:string;rate:number;lbpRate?:number|null}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[open,setOpen]=useState(false),[saving,setSaving]=useState(false);
 const [form,setForm]=useState<Form>(()=>blankForm(settings.defaultCurrency,settings.defaultTax));
 const currencyOptions=currencies.filter(currency=>currency.active||currency.code===form.currency);
 const subtotal=useMemo(()=>Number(form.lines.reduce((sum,line)=>sum+(line.itemId?line.quantity*line.unitCost:0),0).toFixed(2)),[form.lines]);
 const tax=Number((form.taxOverride??subtotal*(Number(form.taxRate)||0)/100).toFixed(2)),total=Number((subtotal+tax).toFixed(2));
 const localCurrency=form.localCurrency||settings.localCurrency;
 const rateFor=(code:string)=>code===localCurrency?1:currencies.find(c=>c.code===code)?.rate??0;
 const purchaseRate=savedRate?.currency===form.currency?savedRate.rate:rateFor(form.currency);
 const configuredLbp=currencies.find(c=>c.code==='LBP')?.rate;
 const lbpRate=form.currency==='LBP'?1:savedRate?.currency===form.currency&&savedRate.lbpRate?savedRate.lbpRate:localCurrency==='LBP'?purchaseRate:configuredLbp?purchaseRate/configuredLbp:null;
 const totalLbp=lbpRate===null?null:Number((total*lbpRate).toFixed(2));
 const costs=purchaseCosts(form.lines.filter(l=>l.itemId),purchaseRate,form.expenses.map(e=>({...e,rate:e.rate??rateFor(e.currency)})));
 function updateExpense(index:number,change:Partial<PurchaseExpense>){setForm(current=>({...current,expenses:current.expenses.map((expense,i)=>i===index?{...expense,...change}:expense)}))}
 const filtered=useMemo(()=>purchases.filter(purchase=>`${purchase.purchaseNumber} ${purchase.supplierName} ${purchase.supplierInvoiceNumber} ${purchase.purchaseDate} ${purchase.notes}`.toLowerCase().includes(query.toLowerCase())),[purchases,query]);

 async function load(){try{const response=await fetch("/api/purchases"),data=await response.json() as {purchases?:Purchase[];error?:string};if(!response.ok)throw new Error(data.error);setError("");setPurchases(data.purchases??[])}catch(cause){setError(cause instanceof Error?cause.message:"Could not load purchases")}finally{setLoading(false)}}
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/purchases",{signal:controller.signal}).then(async response=>{
   const data=await response.json() as {purchases?:Purchase[];error?:string};
   if(!response.ok)throw new Error(data.error);
   if(!controller.signal.aborted)setPurchases(data.purchases??[]);
  }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Could not load purchases")})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{if(!providedCurrencies.length)void fetch("/api/currencies").then(async response=>await response.json() as {currencies?:Currency[]}).then(data=>setCurrencies(data.currencies??[])).catch(()=>{})},[]);
 useEffect(()=>{void fetch('/api/expense-categories').then(async r=>await r.json() as {categories?:{id:number;name:string;active:boolean}[]}).then(data=>setCategories(data.categories??[])).catch(()=>{})},[]);
 function start(){setPurchaseTab('items');setEditingId(null);setSavedRate(null);setForm(blankForm(settings.defaultCurrency,settings.defaultTax));setOpen(true)}
 async function edit(purchase:Purchase){
  setPurchaseTab('items');setOpeningId(purchase.id);
  try{const response=await fetch(`/api/purchases?id=${purchase.id}`),data=await response.json() as {purchase:Omit<Form,"lines">;lines:Line[];error?:string};if(!response.ok)throw new Error(data.error);setEditingId(purchase.id);setSavedRate(data.purchase.currencyRate?{currency:data.purchase.currency,rate:data.purchase.currencyRate,lbpRate:data.purchase.lbpRate}:null);setForm({...data.purchase,expenses:data.purchase.expenses??[],lines:[...data.lines,blankLine()]});setOpen(true)}
  catch(cause){toast.error(cause instanceof Error?cause.message:"Could not open purchase")}
  finally{setOpeningId(null)}
 }
 function updateLine(index:number,change:Partial<Line>){setForm(current=>{const lines=current.lines.map((line,i)=>i===index?{...line,...change}:line);if(index===lines.length-1&&lines[index].itemId)lines.push(blankLine());return {...current,lines}})}
 async function submit(event:FormEvent){
  event.preventDefault();
  const entered=form.lines.filter(line=>line.itemId||line.unitCost||line.description);
  if(!entered.length){toast.error("Add at least one item");return}
  if(form.expenses.some(e=>!e.category.trim()||!e.description.trim()||!Number.isFinite(e.amount)||e.amount<=0)){setPurchaseTab('expenses');toast.error('Complete the category, description and positive amount for each expense.');return}
  setSaving(true);
  try{const response=await fetch("/api/purchases",{method:editingId?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,id:editingId,lines:entered})}),data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error);toast.success(editingId?"Purchase updated and stock adjusted":"Purchase registered and stock updated");setOpen(false);setLoading(true);await load();onStockChanged()}
  catch(cause){toast.error(cause instanceof Error?cause.message:"Could not register purchase")}
  finally{setSaving(false)}
 }

 return <div className="space-y-5">
  <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm"><div><h2 className="text-lg font-bold">Purchase invoices</h2><p className="text-sm text-slate-500">Record supplier invoices and add received quantities to stock.</p></div><Button onClick={start} className="bg-[#ef4e6f] hover:bg-[#c93454]"><Plus/>New purchase</Button></section>
  {(!items.length||!suppliers.length)&&<p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{!suppliers.length?"Add a supplier before registering a purchase.":"Add items before registering a purchase."}</p>}
  <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
   <div className="border-b p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search purchases…" className="pl-9"/></div></div>
   {loading?<p className="p-8 text-center text-slate-500">Loading purchases…</p>:error?<div className="p-8 text-center"><p className="mb-3 text-red-700">{error}</p><Button variant="outline" onClick={()=>{setLoading(true);void load()}}>Try again</Button></div>:filtered.length?<Table><TableHeader><TableRow><TableHead>Purchase</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Supplier invoice</TableHead><TableHead className="text-right">Lines</TableHead><TableHead className="text-right">Total / LBP</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{filtered.map(purchase=><TableRow key={purchase.id}><TableCell className="font-mono text-xs font-semibold">{purchase.purchaseNumber}</TableCell><TableCell>{new Date(purchase.purchaseDate+"T00:00:00").toLocaleDateString()}</TableCell><TableCell className="font-semibold">{purchase.supplierName}<small className="block text-slate-500">Warehouse: {purchase.warehouseCode}</small></TableCell><TableCell>{purchase.supplierInvoiceNumber||"—"}</TableCell><TableCell className="text-right">{purchase.lineCount}</TableCell><TableCell className="text-right font-bold">{money(purchase.total,purchase.currency)}<small className="block font-normal text-slate-500">{purchase.totalLbp==null?'LBP countervalue not saved':money(purchase.totalLbp,'LBP')}</small></TableCell><TableCell><Button size="icon-sm" variant="ghost" aria-label={`Edit ${purchase.purchaseNumber}`} disabled={openingId!==null||saving} onClick={()=>void edit(purchase)}><Edit3/></Button></TableCell></TableRow>)}</TableBody></Table>:<div className="grid min-h-64 place-items-center p-8 text-center"><div><ShoppingCart className="mx-auto mb-3 size-10 text-slate-400"/><h3 className="font-bold">No purchases yet</h3><p className="text-sm text-slate-500">Supplier invoices will appear here.</p></div></div>}
  </section>
  <Dialog open={open} onOpenChange={value=>{if(!saving)setOpen(value)}}>
   <DialogContent ref={dialogRef} className="h-[96dvh] max-w-[calc(100%-1rem)] overflow-hidden p-0 sm:max-w-[min(1440px,96vw)]">
    <form onSubmit={submit} className="flex min-h-0 flex-col overflow-hidden">
     <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12"><DialogTitle>{editingId?"Edit purchase invoice":"New purchase invoice"}</DialogTitle><DialogDescription>Record received items and allocate purchase expenses to their landed cost.</DialogDescription></DialogHeader>
     <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
       <div className="sm:col-span-2"><Field label="Supplier" required><Combobox items={suppliers} value={suppliers.find(supplier=>supplier.id===form.supplierId)??null} onValueChange={supplier=>setForm({...form,supplierId:supplier?.id??0,lines:form.lines.map(line=>{const item=items.find(i=>i.id===line.itemId),unit=item?.itemSuppliers.find(s=>s.supplierId===supplier?.id)?.unit||item?.purchaseUnit||line.unit||'unit',factor=item?.units.find(u=>u.code===unit)?.factor??1;return {...line,unit,unitFactor:factor,unitCost:line.unitCost*factor/(line.unitFactor||1)}})})} itemToStringLabel={supplier=>supplier.code+' · '+supplier.name} isItemEqualToValue={(item,value)=>item.id===value.id}><ComboboxInput className="w-full" aria-label="Supplier" placeholder="Search code or name"/><ComboboxContent portalContainer={dialogRef}><ComboboxEmpty>No matching supplier.</ComboboxEmpty><ComboboxList>{supplier=><ComboboxItem key={supplier.id} value={supplier}><span className="font-mono text-xs font-semibold text-slate-500">{supplier.code}</span><span>{supplier.name}</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></Field></div>
       <Field label="Supplier invoice no."><Input aria-label="Supplier invoice number" maxLength={2000} value={form.supplierInvoiceNumber} onChange={event=>setForm({...form,supplierInvoiceNumber:event.target.value})}/></Field>
       <Field label="Date" required><Input aria-label="Purchase date" required type="date" value={form.purchaseDate} onChange={event=>setForm({...form,purchaseDate:event.target.value})}/></Field>
       <Field label="Currency" required><Select value={form.currency} onValueChange={currency=>setForm({...form,currency})}><SelectTrigger className="w-full" aria-label="Purchase currency"><SelectValue/></SelectTrigger><SelectContent>{currencyOptions.map(currency=><SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent></Select></Field>
       <Field label="Warehouse" required><WarehouseSelect value={form.warehouseCode} onChange={warehouseCode=>setForm({...form,warehouseCode})}/></Field>
       <Field label="Tax %"><Input aria-label="Purchase tax percent" type="number" min="0" max="100" step="any" value={form.taxRate} onChange={event=>setForm({...form,taxRate:Number(event.target.value)})}/></Field>
      </section>
      <Tabs value={purchaseTab} onValueChange={setPurchaseTab}><TabsList aria-label="Purchase sections" className="mb-3"><TabsTrigger value="items" type="button">Items ({form.lines.filter(l=>l.itemId).length})</TabsTrigger><TabsTrigger value="expenses" type="button">Expenses ({form.expenses.length})</TabsTrigger></TabsList><TabsContent value="items">
      <section className="space-y-3"><div><h3 className="font-semibold">Items received</h3><p className="text-xs text-slate-500">Costs are per selected unit in {form.currency}. Landed cost = entered cost × (1 + expense %).</p></div>
       {form.lines.map((line,index)=><div key={index} className="space-y-4 rounded-xl border bg-white p-4">
        <div className="flex items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs text-slate-500">{index+1}</span><div className="min-w-0 flex-1"><ItemPicker items={items} value={line.itemId} container={dialogRef} kind="purchase" supplierId={form.supplierId} onSelect={(item,unit)=>{const supplierId=form.supplierId||item?.itemSuppliers.find(s=>s.isDefault)?.supplierId||0;setForm(current=>{const lines=current.lines.map((l,n)=>n===index?{...l,itemId:item?.id??0,description:item?.name??'',unit,unitFactor:item?.units.find(u=>u.code===unit)?.factor??1}:l);if(index===lines.length-1&&item)lines.push(blankLine());return {...current,supplierId,lines}})}}/></div><Button type="button" size="icon-sm" variant="ghost" aria-label={'Remove item '+(index+1)} onClick={()=>setForm(current=>({...current,lines:current.lines.length===1?[blankLine()]:current.lines.filter((_,i)=>i!==index)}))}><X/></Button></div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
         <Field label="Quantity"><Input aria-label={'Quantity '+(index+1)} type="number" min="0.000001" step="any" value={line.quantity} onChange={event=>updateLine(index,{quantity:Number(event.target.value)})}/></Field>
         <Field label="Unit"><UnitSelect item={items.find(i=>i.id===line.itemId)} value={line.unit} onChange={(unit,factor,old)=>updateLine(index,{unit,unitFactor:factor,unitCost:Number((line.unitCost*factor/old).toFixed(4))})}/></Field>
         <Field label={'Entered cost · '+form.currency}><Input aria-label={'Entered unit cost '+(index+1)} type="number" min="0" step="any" value={line.unitCost||""} onChange={event=>updateLine(index,{unitCost:Number(event.target.value)})}/></Field>
         <Field label={'Landed cost · '+form.currency}><output className="flex min-h-9 items-center rounded-md bg-rose-50 px-3 font-semibold tabular-nums text-[#c93454]">{line.itemId?money(line.unitCost*(1+costs.expensePercent/100),form.currency):'—'}</output></Field>
         <Field label="Goods line total"><output className="flex min-h-9 items-center px-1 font-semibold tabular-nums">{line.itemId?money(line.quantity*line.unitCost,form.currency):'—'}</output></Field>
        </div>
       </div>)}<p className="text-xs text-slate-500">A blank item row is added automatically. Expenses do not change entered costs.</p>
      </section>
      </TabsContent><TabsContent value="expenses">
      <section className="space-y-3 rounded-xl border bg-slate-50 p-4">
       <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Purchase expenses</h3><p className="mt-1 text-xs text-slate-500">Allocated by goods value before tax. All amounts are converted to {localCurrency}.</p></div><Button type="button" variant="outline" disabled={form.expenses.length>=100} onClick={()=>setForm(current=>({...current,expenses:[...current.expenses,{category:'',description:'',currency:form.currency,amount:0}]}))}><Plus/>Add expense</Button></div>
       <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={()=>{setCategoryLine(null);setCategoryOpen(true)}}><Plus/>New category</Button><p className="text-xs text-slate-500">Manage categories in Stock flow → Master data → Expense categories.</p></div>
       {!form.expenses.length&&<p className="py-3 text-sm text-slate-500">Add freight, customs, handling or other costs for this purchase.</p>}
       {form.expenses.map((expense,index)=><div key={index} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_110px_140px_170px_32px] xl:items-start">
        <Field label="Category" required><Select value={expense.category} onValueChange={category=>updateExpense(index,{category})}><SelectTrigger className="w-full" aria-label={'Expense category '+(index+1)}><SelectValue placeholder="Select category"/></SelectTrigger><SelectContent>{expense.category&&!categories.some(c=>c.name===expense.category)&&<SelectItem value={expense.category}>{expense.category} (saved)</SelectItem>}{categories.filter(c=>c.active||c.name===expense.category).map(c=><SelectItem key={c.id} value={c.name}>{c.name}{c.active?'':' (inactive)'}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="sm" className="justify-start px-0" onClick={()=>{setCategoryLine(index);setCategoryOpen(true)}}><Plus/>New category</Button></Field>
        <Field label="Description" required><Input aria-label={'Expense description '+(index+1)} required maxLength={2000} value={expense.description} onChange={e=>updateExpense(index,{description:e.target.value})}/></Field>
        <Field label="Currency"><Select value={expense.currency} onValueChange={currency=>updateExpense(index,{currency,rate:undefined,id:undefined})}><SelectTrigger className="w-full" aria-label={'Expense currency '+(index+1)}><SelectValue/></SelectTrigger><SelectContent>{currencies.filter(c=>c.active||c.code===expense.currency).map(c=><SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Amount" required><Input aria-label={'Expense amount '+(index+1)} required type="number" min="0.000001" step="any" value={expense.amount||''} onChange={e=>updateExpense(index,{amount:Number(e.target.value)})}/></Field>
        <Field label={'Local amount · '+localCurrency}><output className="flex min-h-9 items-center font-semibold tabular-nums">{money(expense.amount*(expense.rate??rateFor(expense.currency)),localCurrency)}</output><small className="text-slate-500">1 {expense.currency} = {expense.rate??rateFor(expense.currency)} {localCurrency}</small></Field>
        <Button className="xl:mt-6" type="button" size="icon-sm" variant="ghost" aria-label={'Remove expense '+(index+1)} onClick={()=>setForm(current=>({...current,expenses:current.expenses.filter((_,i)=>i!==index)}))}><X/></Button>
       </div>)}
       <p className="text-xs text-slate-500">Rates come from Company Configuration and are saved with the purchase. These entries allocate inventory cost; record expense payments separately.</p>
      </section>
      </TabsContent></Tabs>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
       <Field label="Notes"><Textarea aria-label="Purchase notes" maxLength={2000} rows={4} value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
       <div className="space-y-2 rounded-xl border bg-rose-50/50 p-4 text-sm"><h3 className="font-semibold">Landed cost · {localCurrency}</h3><div className="flex justify-between gap-3"><span>Goods before tax</span><span>{money(costs.goodsLocal,localCurrency)}</span></div><div className="flex justify-between gap-3"><span>Total expenses</span><span>{money(costs.expensesLocal,localCurrency)}</span></div><div className="flex justify-between gap-3"><span>Expense allocation</span><strong>{costs.expensePercent.toLocaleString('en-US',{maximumFractionDigits:4})}%</strong></div><div className="flex justify-between gap-3 border-t pt-2 font-bold text-[#c93454]"><span>Total landed cost</span><span>{money(costs.landedLocal,localCurrency)}</span></div><p className="text-xs text-slate-500">1 {form.currency} = {purchaseRate} {localCurrency}. Tax excluded.</p>{costs.expensesLocal>0&&costs.goodsLocal<=0&&<p role="alert" className="text-red-700">Enter a positive goods subtotal to allocate expenses.</p>}</div>
       <div className="rounded-xl bg-[#211b20] p-4 text-white"><div className="flex items-center gap-2 text-white/60"><PackageCheck className="size-4"/>Supplier invoice total</div><div className="mt-3 space-y-1 text-sm"><div className="flex justify-between"><span className="text-white/60">Goods subtotal</span><span>{money(subtotal,form.currency)}</span></div><div className="flex justify-between"><label htmlFor="purchase-tax-total" className="text-white/60">Total tax · {form.currency}</label><Input id="purchase-tax-total" className="w-36 bg-white text-slate-900" type="number" min="0" step="0.01" required value={tax} onChange={event=>setForm({...form,taxOverride:Number(event.target.value)})}/></div><div className="flex items-center justify-between text-xs text-white/70"><span>{form.taxOverride==null?'Calculated from tax %':'Manual tax total'}</span>{form.taxOverride!=null&&<Button type="button" variant="ghost" size="sm" className="text-white" onClick={()=>setForm({...form,taxOverride:null})}>Use tax %</Button>}</div></div><strong className="mt-3 block border-t border-white/15 pt-3 text-right text-2xl text-[#ff9caf]">{money(total,form.currency)}</strong><div className="mt-2 border-t border-white/15 pt-2 text-right"><span className="block text-xs text-white/60">LBP countervalue</span><strong className="text-xl">{totalLbp===null?'Rate not configured':money(totalLbp,'LBP')}</strong><small className="block text-white/60">{lbpRate===null?'Configure LBP in Company Configuration.':'1 '+form.currency+' = '+lbpRate.toLocaleString('en-US',{maximumFractionDigits:6})+' LBP'}</small></div><p className="mt-2 text-xs text-white/60">Purchase expenses are shown separately.</p></div>
      </div>
     </div>
     <DialogFooter className="shrink-0 border-t px-6 py-3"><Button type="button" variant="outline" disabled={saving} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={saving||!form.supplierId||!purchaseRate||(form.expenses.length>0&&costs.goodsLocal<=0)} className="bg-[#ef4e6f] hover:bg-[#c93454]">{saving?"Saving…":"Save and update stock"}</Button></DialogFooter>
    </form>
   </DialogContent>
  </Dialog>
  <ExpenseCategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} onSaved={category=>{setCategories(current=>[...current.filter(c=>c.id!==category.id),category].sort((a,b)=>a.name.localeCompare(b.name)));if(categoryLine!==null)updateExpense(categoryLine,{category:category.name})}}/>
 </div>
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="grid gap-1.5"><Label>{label}{required&&<span className="text-red-500"> *</span>}</Label>{children}</div>}
