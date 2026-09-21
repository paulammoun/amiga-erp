"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";

type Advance={receiptId:number;receiptNumber:string;receiptDate:string;customerId:number;customerName:string;receiptAmount:number;receiptCurrency:string;receiptCurrencyRate:number;available:number};
type Application={id:number;applicationDate:string;amount:number;receiptNumber:string;customerName:string;invoiceNumber:string;invoiceCurrency:string};
type Invoice={id:number;invoiceNumber:string;invoiceDate:string;outstanding:number;currency:string;currencyRate:number};
const today=()=>{const date=new Date(),offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,10)};
const money=(value:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency}).format(value||0);

export default function CustomerAdvances({onSaved}:{onSaved:()=>void}){
  const dialogRef=useRef<HTMLDivElement>(null);
  const [advances,setAdvances]=useState<Advance[]>([]);
  const [applications,setApplications]=useState<Application[]>([]);
  const [invoices,setInvoices]=useState<Invoice[]>([]);
  const [currency,setCurrency]=useState("USD");
  const [loading,setLoading]=useState(true),[loadingInvoices,setLoadingInvoices]=useState(false),[saving,setSaving]=useState(false);
  const [selected,setSelected]=useState<Advance|null>(null);
  const [form,setForm]=useState({invoiceId:0,amount:0,applicationDate:today(),requestKey:""});

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/advance-applications"),data=await response.json() as {advances?:Advance[];applications?:Application[];currency?:string;error?:string};
      if(!response.ok)throw new Error(data.error||"Could not load customer advances.");
      setAdvances(data.advances??[]);setApplications(data.applications??[]);setCurrency(data.currency??"USD");
    }catch(error){toast.error(error instanceof Error?error.message:"Could not load customer advances.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  useEffect(()=>{
    if(!selected){setInvoices([]);setLoadingInvoices(false);return}
    const controller=new AbortController();
    setLoadingInvoices(true);
    fetch("/api/receipts?customerId="+selected.customerId,{signal:controller.signal})
      .then(async response=>{const data=await response.json() as {invoices?:Invoice[];error?:string};if(!response.ok)throw new Error(data.error||"Could not load open invoices.");return data.invoices??[]})
      .then(setInvoices).catch(error=>{if(error.name!=="AbortError")toast.error(error.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoadingInvoices(false)});
    return()=>controller.abort();
  },[selected]);
  const invoice=invoices.find(value=>value.id===form.invoiceId);
  const availableForInvoice=invoice&&selected?selected.available*Number(selected.receiptCurrencyRate||1)/Number(invoice.currencyRate||1):0;
  function start(advance:Advance){setForm({invoiceId:0,amount:0,applicationDate:today(),requestKey:crypto.randomUUID()});setSelected(advance)}
  async function submit(event:FormEvent){
    event.preventDefault();
    if(!selected||!invoice)return;
    setSaving(true);
    try{
      const response=await fetch("/api/advance-applications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({receiptId:selected.receiptId,invoiceId:invoice.id,amount:form.amount,applicationDate:form.applicationDate,requestKey:form.requestKey})});
      const data=await response.json() as {error?:string;application?:{receiptNumber:string;invoiceNumber:string}};
      if(!response.ok||!data.application)throw new Error(data.error||"Could not apply the advance.");
      toast.success(`Advance from ${data.application.receiptNumber} applied to ${data.application.invoiceNumber}`);
      setSelected(null);await load();onSaved();
    }catch(error){toast.error(error instanceof Error?error.message:"Could not apply the advance.")}
    finally{setSaving(false)}
  }
  return <div className="space-y-5">
    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><ArrowRightLeft className="size-5"/></span><div><h2 className="font-bold">Customer advances</h2><p className="text-sm text-slate-500">Money already received but not yet applied to invoices. Applying it here does not record a second payment.</p></div></div></section>
    <section className="overflow-x-auto rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h3 className="font-bold">Available advances</h3></div>
      {loading?<div className="grid min-h-48 place-items-center text-slate-500">Loading advances…</div>:advances.length?
        <Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Original payment</TableHead><TableHead className="text-right">Available</TableHead><TableHead/></TableRow></TableHeader><TableBody>{advances.map(advance=>
          <TableRow key={advance.receiptId}><TableCell className="font-mono font-semibold">{advance.receiptNumber}</TableCell><TableCell>{new Date(advance.receiptDate+"T00:00:00").toLocaleDateString()}</TableCell><TableCell>{advance.customerName}</TableCell><TableCell>{money(advance.receiptAmount,advance.receiptCurrency)}</TableCell><TableCell className="text-right font-bold">{money(advance.available,advance.receiptCurrency)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>start(advance)}>Apply to invoice</Button></TableCell></TableRow>
        )}</TableBody></Table>:
        <p className="p-8 text-center text-slate-500">No paid advances remain to apply.</p>}
    </section>
    <section className="overflow-x-auto rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h3 className="font-bold">Advance applications</h3></div>
      {applications.length?<Table className="min-w-[650px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Advance receipt</TableHead><TableHead>Invoice</TableHead><TableHead className="text-right">Applied</TableHead></TableRow></TableHeader><TableBody>{applications.map(row=>
        <TableRow key={row.id}><TableCell>{new Date(row.applicationDate+"T00:00:00").toLocaleDateString()}</TableCell><TableCell>{row.customerName}</TableCell><TableCell className="font-mono">{row.receiptNumber}</TableCell><TableCell className="font-mono">{row.invoiceNumber}</TableCell><TableCell className="text-right font-semibold">{money(row.amount,row.invoiceCurrency)}</TableCell></TableRow>
      )}</TableBody></Table>:<p className="p-8 text-center text-slate-500">No advances have been applied to invoices yet.</p>}
    </section>
    <Dialog open={!!selected} onOpenChange={value=>{if(!value&&!saving)setSelected(null)}}><DialogContent ref={dialogRef} className="sm:max-w-xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Apply paid advance</DialogTitle><DialogDescription>Use money from {selected?.receiptNumber} to reduce an open invoice for {selected?.customerName}.</DialogDescription></DialogHeader><div className="grid gap-4 py-5">
      <div className="rounded-xl bg-slate-50 p-4 text-sm">Available from this receipt: <strong>{money(selected?.available??0,selected?.receiptCurrency||currency)}</strong></div>
      <div className="grid gap-1.5"><Label>Invoice <span className="text-red-500">*</span></Label><Combobox items={invoices} value={invoice??null} onValueChange={value=>setForm(current=>({...current,invoiceId:value?.id??0,amount:value?Math.min(value.outstanding,(selected?.available??0)*Number(selected?.receiptCurrencyRate||1)/Number(value.currencyRate||1)):0}))} itemToStringLabel={value=>`${value.invoiceNumber} · ${money(value.outstanding,value.currency)} due`} isItemEqualToValue={(a,b)=>a.id===b.id}><ComboboxInput className="w-full" aria-label="Invoice" placeholder={loadingInvoices?"Loading invoices…":"Search open invoice"}/><ComboboxContent portalContainer={dialogRef}><ComboboxEmpty>No open invoices for this customer.</ComboboxEmpty><ComboboxList>{value=><ComboboxItem key={value.id} value={value}><span className="font-mono font-semibold">{value.invoiceNumber}</span><span>{money(value.outstanding,currency)} due</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>Amount to apply <span className="text-red-500">*</span></Label><Input aria-label="Amount to apply" required type="number" min=".01" step=".01" max={Math.min(invoice?.outstanding??0,availableForInvoice)} value={form.amount||""} onChange={event=>setForm({...form,amount:Number(event.target.value)})}/><p className="text-xs text-slate-500">Invoice currency: {invoice?.currency||currency}</p></div><div className="grid gap-1.5"><Label>Application date <span className="text-red-500">*</span></Label><Input required type="date" value={form.applicationDate} onChange={event=>setForm({...form,applicationDate:event.target.value})}/></div></div>
      {invoice&&<p className="text-sm text-slate-600">Invoice balance after application: <strong>{money(Math.max(0,invoice.outstanding-form.amount),invoice.currency)}</strong></p>}
    </div><DialogFooter><Button type="button" variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button className="bg-[#ef4e6f] hover:bg-[#c93454]" disabled={saving||!invoice||form.amount<=0||form.amount>Math.min(invoice.outstanding,availableForInvoice)+0.00001}>{saving?"Applying…":"Apply advance"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
