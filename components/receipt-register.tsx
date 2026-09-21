"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Plus, Printer, Search } from "lucide-react";
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
import type {Currency} from "./currency-register";

type Customer = { id: number; code: string; name: string };
type Account = { id: number; accountNumber: string; name: string; currency: string; active: boolean };
type InvoiceBalance = { id: number; invoiceNumber: string; invoiceDate: string; outstanding: number; currency:string; currencyRate:number };
type Allocation = { invoiceId: number; amount: number };
type Receipt = {
  id: number; receiptNumber: string; customerId: number; customerName: string; customerCode: string;
  receiptDate: string; amount: number; currency: string; accountNumber: string; invoiceCount: number;
  advanceBalance: number; paymentMethod: string; reference: string; notes: string;
};
type Form = {
  customerId: number; receiptDate: string; amount: number; currency: string; accountNumber: string;
  allocations: Allocation[]; paymentMethod: string; reference: string; notes: string;requestKey:string;
};
const methods=[["cash","Cash"],["card","Card"],["bank_transfer","Bank transfer"],["check","Check"],["other","Other"]] as const;
const methodLabel=(value:string)=>methods.find(([key])=>key===value)?.[1]??value;
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const money=(value:number,currency:string)=>{
  const safe=/^[A-Z]{3}$/.test(currency)?currency:"USD";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:safe,maximumFractionDigits:safe==="LBP"?0:2}).format(value||0);
};
const today=()=>{const date=new Date(),offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,10)};
const blankForm=(settings:WorkshopSettings):Form=>({
  customerId:0,receiptDate:today(),amount:0,currency:settings.defaultCurrency,accountNumber:"",
  allocations:[],paymentMethod:"cash",reference:"",notes:"",requestKey:crypto.randomUUID()
});

export default function ReceiptRegister({customers,settings,currencies:providedCurrencies=[],onSaved}:{customers:Customer[];settings:WorkshopSettings;currencies?:Currency[];onSaved:()=>void}){
  const dialogRef=useRef<HTMLDivElement>(null);
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [currencies,setCurrencies]=useState<Currency[]>(providedCurrencies);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [invoices,setInvoices]=useState<InvoiceBalance[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadingInvoices,setLoadingInvoices]=useState(false);
  const [saving,setSaving]=useState(false);
  const [open,setOpen]=useState(false);
  const [legacy,setLegacy]=useState<Receipt|null>(null);
  const [query,setQuery]=useState("");
  const [form,setForm]=useState<Form>(()=>blankForm(settings));

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/receipts"),data=await response.json() as {receipts?:Receipt[];error?:string};
      if(!response.ok)throw new Error(data.error||"Could not load receipts.");
      setReceipts(data.receipts??[]);
    }catch(error){toast.error(error instanceof Error?error.message:"Could not load receipts.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  useEffect(()=>{if(!providedCurrencies.length)void fetch("/api/currencies").then(async response=>await response.json() as {currencies?:Currency[]}).then(data=>setCurrencies(data.currencies??[])).catch(()=>{})},[]);
  useEffect(()=>{
    if(!open||!form.customerId){setInvoices([]);setLoadingInvoices(false);return}
    const controller=new AbortController();
    setLoadingInvoices(true);
    fetch("/api/receipts?customerId="+form.customerId,{signal:controller.signal})
      .then(async response=>{const data=await response.json() as {invoices?:InvoiceBalance[];error?:string};if(!response.ok)throw new Error(data.error||"Could not load invoices.");return data.invoices??[]})
      .then(setInvoices)
      .catch(error=>{if(error.name!=="AbortError")toast.error(error.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoadingInvoices(false)});
    return()=>controller.abort();
  },[open,form.customerId]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return needle?receipts.filter(receipt=>`${receipt.receiptNumber} ${receipt.customerCode} ${receipt.customerName} ${receipt.reference} ${receipt.accountNumber}`.toLowerCase().includes(needle)):receipts;
  },[query,receipts]);
  const receiptRate=Number(currencies.find(currency=>currency.code===form.currency)?.rate)||1;
  const applied=round(form.allocations.reduce((sum,row)=>{const invoice=invoices.find(value=>value.id===row.invoiceId);return sum+row.amount*Number(invoice?.currencyRate||1)/receiptRate},0));
  const advance=round(Math.max(0,form.amount-applied));
  const invalidApplications=applied>form.amount+0.00001
    ||form.allocations.some(row=>row.amount<=0||row.amount>(invoices.find(invoice=>invoice.id===row.invoiceId)?.outstanding??0)+0.00001);
  const accountChoices=accounts.filter(account=>account.active&&account.currency===form.currency);

  async function startReceipt(receipt?:Receipt){
    setLegacy(receipt??null);
    setForm(receipt?{
      customerId:receipt.customerId,receiptDate:receipt.receiptDate,amount:receipt.amount,currency:receipt.currency,
      accountNumber:"",allocations:[],paymentMethod:receipt.paymentMethod,reference:receipt.reference,notes:receipt.notes,requestKey:crypto.randomUUID()
    }:blankForm(settings));
    try{
      const response=await fetch("/api/accounts?posting=1"),data=await response.json() as {accounts?:Account[];error?:string};
      if(!response.ok)throw new Error(data.error||"Could not load chart of accounts.");
      setAccounts(data.accounts??[]);
    }catch(error){toast.error(error instanceof Error?error.message:"Could not load chart of accounts.")}
    setOpen(true);
  }
  function setApplication(invoiceId:number,value:number){
    setForm(current=>({
      ...current,
      allocations:value>0
        ?current.allocations.some(row=>row.invoiceId===invoiceId)
          ?current.allocations.map(row=>row.invoiceId===invoiceId?{invoiceId,amount:value}:row)
          :[...current.allocations,{invoiceId,amount:value}]
        :current.allocations.filter(row=>row.invoiceId!==invoiceId)
    }));
  }
  function useAvailable(invoice:InvoiceBalance){
    const existing=form.allocations.find(row=>row.invoiceId===invoice.id)?.amount??0;
    const existingReceipt=existing*Number(invoice.currencyRate||1)/receiptRate,availableReceipt=Math.max(0,form.amount-applied+existingReceipt);
    setApplication(invoice.id,round(Math.min(invoice.outstanding,availableReceipt*receiptRate/Number(invoice.currencyRate||1))));
  }
  async function submit(event:FormEvent){
    event.preventDefault();
    if(invalidApplications)return;
    setSaving(true);
    try{
      const body=legacy?{id:legacy.id,accountNumber:form.accountNumber,allocations:form.allocations}:form;
      const response=await fetch("/api/receipts",{method:legacy?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json() as {receipt?:{receiptNumber:string};error?:string};
      if(!response.ok||!data.receipt)throw new Error(data.error||"Could not post receipt.");
      toast.success(`${data.receipt.receiptNumber} ${legacy?"posted":"created and posted"}`);
      setOpen(false);
      await load();
      onSaved();
    }catch(error){toast.error(error instanceof Error?error.message:"Could not post receipt.")}
    finally{setSaving(false)}
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search receipt, customer or account" className="bg-white pl-9"/></div>
      <Button onClick={()=>void startReceipt()} disabled={!customers.length} className="bg-[#ef4e6f] text-white hover:bg-[#c93454] sm:ml-auto"><Plus/>New receipt</Button>
    </div>
    {!customers.length&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Add a customer before creating a receipt.</p>}
    <section className="overflow-x-auto rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      {loading?<div className="grid min-h-64 place-items-center text-slate-500">Loading customer receipts…</div>:filtered.length?
        <Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Invoices applied</TableHead><TableHead>Paid in advance</TableHead><TableHead>Payment account</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{filtered.map(receipt=>
          <TableRow key={receipt.id}><TableCell className="font-mono text-xs font-semibold">{receipt.receiptNumber}</TableCell><TableCell>{new Date(receipt.receiptDate+"T00:00:00").toLocaleDateString()}</TableCell><TableCell className="font-semibold">{receipt.customerName}<small className="block font-mono text-slate-500">{receipt.customerCode}</small></TableCell><TableCell>{receipt.invoiceCount||"—"}</TableCell><TableCell className="font-semibold">{receipt.accountNumber?money(receipt.advanceBalance,receipt.currency):"Unposted"}</TableCell><TableCell className="font-mono text-xs">{receipt.accountNumber||"—"}</TableCell><TableCell className="text-right font-bold">{money(receipt.amount,receipt.currency)}</TableCell><TableCell className="whitespace-nowrap">{!receipt.accountNumber&&<Button size="sm" variant="outline" onClick={()=>void startReceipt(receipt)}>Post</Button>}<a className="ml-2 inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-slate-100" href={`/receipt-print?id=${receipt.id}`} target="_blank" rel="noopener noreferrer"><Printer className="size-3.5"/>Print</a></TableCell></TableRow>
        )}</TableBody></Table>:
        <div className="grid min-h-64 place-items-center p-8 text-center"><div><Banknote className="mx-auto mb-3 size-10 text-slate-400"/><h3 className="font-bold">No customer receipts yet</h3><p className="text-sm text-slate-500">Customer payments will appear here.</p></div></div>}
    </section>

    <Dialog open={open} onOpenChange={value=>{if(!saving)setOpen(value)}}><DialogContent ref={dialogRef} className="max-h-[94vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={submit}>
      <DialogHeader><DialogTitle>{legacy?"Post "+legacy.receiptNumber:"New customer receipt"}</DialogTitle><DialogDescription>Enter the payment, apply any part of it to open invoices, and keep the rest as paid in advance.</DialogDescription></DialogHeader>
      <div className="grid gap-5 py-5">
        <Field label="Customer" required>{legacy?<Input readOnly value={legacy.customerCode+" · "+legacy.customerName}/>:<Combobox items={customers} value={customers.find(customer=>customer.id===form.customerId)??null} onValueChange={customer=>setForm(current=>({...current,customerId:customer?.id??0,allocations:[]}))} itemToStringLabel={customer=>`${customer.code} · ${customer.name}`} isItemEqualToValue={(item,value)=>item.id===value.id}><ComboboxInput className="w-full" aria-label="Customer" placeholder="Search code or name"/><ComboboxContent portalContainer={dialogRef}><ComboboxEmpty>No matching customer.</ComboboxEmpty><ComboboxList>{customer=><ComboboxItem key={customer.id} value={customer}><span className="font-mono text-xs font-semibold text-slate-500">{customer.code}</span><span>{customer.name}</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>}</Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Receipt date" required><Input required readOnly={!!legacy} type="date" value={form.receiptDate} onChange={event=>setForm({...form,receiptDate:event.target.value})}/></Field><Field label="Payment method" required>{legacy?<Input readOnly value={methodLabel(form.paymentMethod)}/>:<Select value={form.paymentMethod} onValueChange={paymentMethod=>setForm({...form,paymentMethod})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{methods.map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>}</Field></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><Field label="Amount received" required><Input required readOnly={!!legacy} type="number" min="0.01" step="0.01" value={form.amount||""} onChange={event=>setForm({...form,amount:Number(event.target.value)})} placeholder="0.00"/></Field><Field label="Currency" required>{legacy?<Input readOnly value={form.currency}/>:<Select value={form.currency} onValueChange={currency=>setForm(current=>({...current,currency,accountNumber:"",allocations:[]}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{currencies.filter(currency=>currency.active||currency.code===form.currency).map(currency=><SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent></Select>}</Field></div>
        <Field label="Payment account (debit)" required><Combobox items={accountChoices} value={accountChoices.find(account=>account.accountNumber===form.accountNumber)??null} onValueChange={account=>setForm(current=>({...current,accountNumber:account?.accountNumber??""}))} itemToStringLabel={account=>`${account.accountNumber} · ${account.name}`} isItemEqualToValue={(item,value)=>item.id===value.id}><ComboboxInput className="w-full" aria-label="Payment account" placeholder="Search account number or name"/><ComboboxContent portalContainer={dialogRef}><ComboboxEmpty>No active {form.currency} accounts.</ComboboxEmpty><ComboboxList>{account=><ComboboxItem key={account.id} value={account}><span className="font-mono text-xs font-semibold text-slate-500">{account.accountNumber}</span><span>{account.name}</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></Field>
        <div className="rounded-xl border p-4"><h3 className="font-semibold">Apply to invoices now</h3><p className="mb-3 text-xs text-slate-500">Enter each allocation in that invoice's currency. A partial payment leaves the invoice open.</p>
          {!form.customerId?<p className="text-sm text-slate-500">Select a customer to see open invoices.</p>:loadingInvoices?<p className="text-sm text-slate-500">Loading open invoices…</p>:invoices.length?<div className="max-h-64 space-y-2 overflow-y-auto">{invoices.map(invoice=>{
            const current=form.allocations.find(row=>row.invoiceId===invoice.id)?.amount??0;
            return <div key={invoice.id} className="grid items-center gap-2 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_155px_135px_90px]"><div><strong>{invoice.invoiceNumber}</strong><small className="block text-slate-500">{invoice.invoiceDate}</small></div><span>Due {money(invoice.outstanding,invoice.currency)}</span><Input aria-label={"Amount applied to "+invoice.invoiceNumber} type="number" min="0" max={invoice.outstanding} step=".01" value={current||""} onChange={event=>setApplication(invoice.id,Number(event.target.value))} placeholder={invoice.currency}/><Button type="button" size="sm" variant="outline" onClick={()=>useAvailable(invoice)}>Use available</Button></div>;
          })}</div>:<p className="text-sm text-slate-500">No open invoices. This payment will be paid in advance.</p>}</div>
        <Field label="Reference">{legacy?<Input readOnly value={form.reference}/>:<Input maxLength={200} value={form.reference} onChange={event=>setForm({...form,reference:event.target.value})} placeholder="Check or bank reference"/>}</Field>
        <Field label="Notes">{legacy?<Textarea readOnly value={form.notes} rows={3}/>:<Textarea maxLength={2000} rows={3} value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/>}</Field>
        <div className="rounded-xl bg-[#211b20] p-4 text-white"><div className="flex justify-between text-sm"><span>Applied to invoices</span><span>{money(applied,form.currency)}</span></div><div className="flex justify-between text-sm"><span>Paid in advance</span><span>{money(advance,form.currency)}</span></div><div className="mt-3 flex justify-between border-t border-white/20 pt-3"><strong>Amount received</strong><strong className="text-xl text-[#ff9caf]">{money(form.amount,form.currency||settings.defaultCurrency)}</strong></div>{invalidApplications&&<p className="mt-2 text-sm text-[#ff9caf]">Check the amounts applied to invoices.</p>}</div>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={saving||!form.customerId||form.amount<=0||!form.accountNumber||invalidApplications} className="bg-[#ef4e6f] hover:bg-[#c93454]">{saving?"Saving…":legacy?"Post receipt":"Save and post receipt"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return <div className="grid gap-1.5"><Label>{label}{required&&<span className="text-red-500"> *</span>}</Label>{children}</div>;
}
