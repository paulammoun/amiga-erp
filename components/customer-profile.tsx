"use client";

import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import type {CustomerRecord} from "./customer-master-dialog";

type Invoice={id:number;invoiceNumber:string;invoiceDate:string;status:string;currency:string;currencyRate:number;localCurrency:string;total:number;appliedAmount:number;outstanding:number;createdAt:string};
const money=(n:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency}).format(n);
const title=(value:string)=>value.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());

export default function CustomerProfile({customer,currency,close,edit,newInvoice}:{customer:CustomerRecord|null;currency:string;close:()=>void;edit:(customer:CustomerRecord)=>void;newInvoice:(id:number)=>void}){
 const [history,setHistory]=useState<Invoice[]>([]),[detail,setDetail]=useState<CustomerRecord|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!customer)return;
  const controller=new AbortController();setLoading(true);setError("");setHistory([]);setDetail(null);
  fetch("/api/customers?id="+customer.id,{signal:controller.signal}).then(async response=>{const data=await response.json() as {error?:string;customer:CustomerRecord;invoices:Invoice[]};if(!response.ok)throw new Error(data.error);setDetail(data.customer);setHistory(data.invoices)}).catch(error=>{if(error.name!=="AbortError")setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[customer,retry]);
 const value=detail??customer;
 const total=history.reduce((sum,invoice)=>sum+invoice.total*Number(invoice.currencyRate||1),0),unpaid=history.reduce((sum,invoice)=>sum+invoice.outstanding*Number(invoice.currencyRate||1),0),localCurrency=history[0]?.localCurrency||currency;
 return <Dialog open={!!customer} onOpenChange={open=>{if(!open)close()}}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">{value&&<>
  <DialogHeader><div className="flex flex-wrap items-start justify-between gap-3 pr-8"><div><DialogTitle>{value.name}</DialogTitle><DialogDescription>{value.code}{value.tradingName?` · ${value.tradingName}`:""}</DialogDescription></div><Badge variant="outline" className={value.status==="active"?"border-emerald-200 bg-emerald-50 text-emerald-700":value.status==="on_hold"?"border-amber-200 bg-amber-50 text-amber-700":"border-slate-200 bg-slate-50 text-slate-600"}>{title(value.status)}</Badge></div></DialogHeader>
  <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
   <Detail label="Account number" value={value.accountNumber}/><Detail label="MOF / VAT number" value={value.mofNumber}/><Detail label="Customer type" value={title(value.customerType)}/><Detail label="Phone" value={value.phone}/><Detail label="Mobile" value={value.mobile}/><Detail label="Email" value={value.email}/><Detail label="Customer group" value={title(value.customerGroup)}/><Detail label="Currency" value={value.defaultCurrency}/><Detail label="Payment terms" value={title(value.paymentTerms)}/><div className="sm:col-span-2 lg:col-span-3"><Detail label="Billing address" value={[value.address,value.city,value.country].filter(Boolean).join(", ")}/></div>
  </dl>
  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{close();edit(value)}}>Edit customer</Button><Button disabled={!!value.blockInvoices} title={value.blockInvoices?"New invoices are blocked for this customer":undefined} className="bg-[#ef4e6f] hover:bg-[#c93454]" onClick={()=>{close();newInvoice(value.id)}}>New invoice</Button>{value.creditHold&&<Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Credit hold</Badge>}</div>
  {loading?<p role="status">Loading customer history…</p>:error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(number=>number+1)}>Try again</Button></div>:<>
   {value.contacts?.length?<div className="grid gap-4 lg:grid-cols-2">{value.contacts?.length?<section className="rounded-xl border p-4"><h3 className="font-bold">Contacts</h3><div className="mt-3 divide-y">{value.contacts.map((contact,index)=><div key={contact.id??index} className="py-3 first:pt-0 last:pb-0"><p className="font-semibold">{contact.name}{contact.role?<span className="font-normal text-slate-500"> · {contact.role}</span>:null}</p><p className="text-sm text-slate-500">{[contact.phone,contact.email,contact.receives].filter(Boolean).join(" · ")}</p></div>)}</div></section>:null}</div>:null}
   <h3 className="font-bold">Invoice history</h3>
   <div className="grid grid-cols-3 gap-3 rounded-xl border p-4"><div><p className="text-sm text-slate-500">Invoices</p><strong>{history.length}</strong></div><div><p className="text-sm text-slate-500">Total billed · local</p><strong>{money(total,localCurrency)}</strong></div><div><p className="text-sm text-slate-500">Outstanding · local</p><strong>{money(unpaid,localCurrency)}</strong></div></div>
   {history.length?<div className="divide-y">{history.map(invoice=><div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{invoice.invoiceNumber}</p><p className="text-sm text-slate-500">{new Date(invoice.invoiceDate+"T00:00:00").toLocaleDateString()}</p></div><div className="text-right"><strong>{money(invoice.total,invoice.currency)}</strong><p className={invoice.status==="paid"?"text-sm text-emerald-700":"text-sm text-amber-700"}>{invoice.status==="paid"?"Paid":invoice.status==="partial"?"Partially paid · "+money(invoice.outstanding,invoice.currency)+" due":"Unpaid"}</p></div></div>)}</div>:<p className="py-6 text-center text-slate-500">No invoices for this customer yet.</p>}
  </>}
 </>}</DialogContent></Dialog>;
}

function Detail({label,value}:{label:string;value:string|number|null|undefined}){return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="break-words">{value||"Not provided"}</dd></div>}
