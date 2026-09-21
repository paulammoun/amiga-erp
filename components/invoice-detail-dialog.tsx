"use client";

import {useEffect,useState} from 'react';
import {savedLineTotal,localCountervalues} from '@/lib/invoice-totals';
import {Printer} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

type InvoiceDetail={
 invoice:{lineDiscountTotal:number;calculationVersion:number;id:number;invoiceNumber:string;draftNumber?:string;documentState:"draft"|"posted"|"reversed";invoiceDate:string;dueDate:string;paymentTerms:string;salesmanName?:string;currency:string;currencyRate:number;localCurrency:string;purchaseOrderNumber:string;notes:string;subtotal:number;discountRate:number;discountAmount:number;tax:number;total:number;status:string;appliedAmount:number;outstanding:number;historicalFallbacks:string;reconciliationRequired:number;reconciliationReason?:string};
 customer:{code:string;name:string}|null;
 settings:{defaultCurrency:string;localCurrency:string;localCurrencyRate:number};
 lines:{unit?:string;lineDiscountRate:number;lineDiscountAmount:number;lineType:string;description:string;quantity:number;unitPrice:number;lineTotal:number;discountAmount:number;taxRate:number;taxAmount:number}[];
 creditNotes:{id:number;creditNumber:string;draftNumber:string;documentState:string;creditDate:string;total:number;reason:string}[];
};

export default function InvoiceDetailDialog({invoiceId,onClose,onReturnFocus}:{invoiceId:number|null;onClose:()=>void;onReturnFocus:()=>void}){
 const [data,setData]=useState<InvoiceDetail|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  setData(null);setError('');if(invoiceId===null)return;
  const controller=new AbortController();
  fetch('/api/invoices?id='+invoiceId,{signal:controller.signal}).then(async response=>{
   const value=await response.json() as InvoiceDetail&{error?:string};
   if(!response.ok)throw new Error(value.error||'Could not load invoice details.');
   if(!controller.signal.aborted)setData(value);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load invoice details.')});
  return()=>controller.abort();
 },[invoiceId,retry]);
 const detail=data?.invoice.id===invoiceId?data:null,invoice=detail?.invoice;
 const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:detail?.invoice.currency||detail?.settings.defaultCurrency||'USD'}).format(n);
 return <Dialog open={invoiceId!==null} onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" onCloseAutoFocus={event=>{event.preventDefault();onReturnFocus()}}>
  <DialogHeader><DialogTitle>{invoice?(invoice.documentState==='draft'?(invoice.draftNumber||invoice.invoiceNumber):invoice.invoiceNumber):'Invoice details'}</DialogTitle><DialogDescription>Invoice lines, discount, VAT, payment and linked corrections.</DialogDescription></DialogHeader>
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><p>{error}</p><Button variant="outline" className="mt-3" onClick={()=>setRetry(n=>n+1)}>Try again</Button></div>:!detail||!invoice?<p role="status" className="py-12 text-center text-slate-500">Loading invoice details…</p>:<>
   <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-slate-50 p-4"><div><p className="text-sm text-slate-500">Customer</p><p className="font-semibold">{detail.customer?.name||'Customer unavailable'}</p><p className="text-sm text-slate-500">{detail.customer?.code}</p></div><div><p className="text-sm text-slate-500">Salesman</p><p className="font-semibold">{invoice.salesmanName||'Not assigned'}</p></div><div><p className="text-sm text-slate-500">Invoice date</p><p className="font-semibold">{invoice.invoiceDate}</p><p className="mt-1 text-sm">Due: {invoice.dueDate} · {invoice.paymentTerms.replaceAll('_',' ')}</p>{invoice.purchaseOrderNumber&&<p className="mt-1 text-sm">PO: {invoice.purchaseOrderNumber}</p>}</div><div><Badge variant="outline" className="capitalize">{invoice.documentState}</Badge>{invoice.documentState!=='draft'&&<Badge variant="outline" className="ml-2">{invoice.status==='paid'?'Paid':invoice.status==='partial'?'Partially paid':'Unpaid'}</Badge>}<p className="mt-2 text-sm text-slate-500">Currency: {invoice.currency}</p></div></div>
   {!!invoice.reconciliationRequired&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Review required: {invoice.reconciliationReason}</p>}
   {invoice.historicalFallbacks&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Historical fallback: {invoice.historicalFallbacks}</p>}
   <Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>Description</TableHead>{['Qty','Unit price','Line discount','Invoice discount','VAT %','VAT','Total incl. VAT'].map(h=><TableHead key={h} className="text-right">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{detail.lines.map((line,n)=><TableRow key={n}><TableCell className="max-w-sm whitespace-normal"><small className="block text-slate-500">{line.lineType==='part'?'Item':'Non-item sales'}</small><span className="whitespace-pre-wrap break-words">{line.description}</span></TableCell><TableCell className="text-right">{line.quantity} {line.unit}</TableCell><TableCell className="text-right">{money(line.unitPrice)}</TableCell><TableCell className="text-right"><span className="block text-sm text-slate-500">{line.lineDiscountRate??0}%</span>{money(line.lineDiscountAmount??0)}</TableCell><TableCell className="text-right">{money(line.discountAmount||0)}</TableCell><TableCell className="text-right">{line.taxRate}%</TableCell><TableCell className="text-right">{money(line.taxAmount)}</TableCell><TableCell className="text-right font-semibold">{money(savedLineTotal(line))}</TableCell></TableRow>)}</TableBody></Table>
   <div className="grid gap-5 md:grid-cols-[1fr_320px]"><div>{invoice.notes&&<><h3 className="font-semibold">Notes</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{invoice.notes}</p></>}</div><dl className="space-y-2 rounded-xl border p-4 text-sm">{[['Gross subtotal',invoice.subtotal+(invoice.discountAmount||0)+(invoice.lineDiscountTotal||0)],['Line discounts',-(invoice.lineDiscountTotal||0)],[`Additional invoice discount (${invoice.discountRate||0}%)`,-(invoice.discountAmount||0)],['Net before VAT',invoice.subtotal],['VAT',invoice.tax],['Total incl. VAT',invoice.total],['Amount received',invoice.appliedAmount],['Outstanding amount',invoice.outstanding]].map(([label,value])=><div key={String(label)} className={`flex justify-between gap-4 ${label==='Total incl. VAT'||label==='Outstanding amount'?'border-t pt-2 font-bold':''}`}><dt>{label}</dt><dd className="tabular-nums">{money(Number(value))}</dd></div>)}</dl></div>{invoice.localCurrency!==invoice.currency&&<dl className="ml-auto w-full max-w-sm space-y-2 rounded-xl border bg-slate-50 p-4 text-sm"><dt className="font-semibold">Local countervalue · {invoice.localCurrency}</dt>{Object.entries(localCountervalues(invoice,invoice.currencyRate||detail.settings.localCurrencyRate)).map(([key,value])=><div key={key} className="flex justify-between gap-4"><dt>{key==="subtotal"?"Net before VAT":key==="tax"?"VAT":"Total incl. VAT"}</dt><dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:invoice.localCurrency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}</dd></div>)}</dl>}
  </>}
  <DialogFooter><Button variant="outline" onClick={onClose}>Back to report</Button>{detail&&<a className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#ef4e6f] px-4 text-sm font-medium text-white hover:bg-[#c93454]" href={'/invoice-print?id='+invoiceId} target="_blank" rel="noopener noreferrer"><Printer className="size-4"/>Print / Save PDF<span className="sr-only"> (opens in a new tab)</span></a>}</DialogFooter>
 </DialogContent></Dialog>;
}
