"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, FileSpreadsheet, FilterX, ReceiptText, Printer, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {loadInvoiceReport,reportTotals,type ReportInvoice} from '@/lib/invoice-report';
import InvoiceReportPrint from './invoice-report-print';
import InvoiceDetailDialog from './invoice-detail-dialog';
import {toast} from 'sonner';
type ReportCustomer = { id: number; code: string; name: string };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value || 0); }
  catch { return `${(value || 0).toLocaleString()} ${currency}`; }
}

function dateKey(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function displayDate(value: string) {
  const key = dateKey(value);
  return key ? new Date(`${key}T00:00:00`).toLocaleDateString() : value;
}

export default function InvoiceReport({ customers, currency, companyName }: { customers: ReportCustomer[]; currency: string; companyName:string }) {
  const [invoices,setInvoices]=useState<ReportInvoice[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[exporting,setExporting]=useState(false);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');loadInvoiceReport(controller.signal).then(setInvoices).catch(e=>{if(!controller.signal.aborted){setInvoices([]);setError(e instanceof Error?e.message:'Could not load report')}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[reload]);
  const [selectedInvoiceId,setSelectedInvoiceId]=useState<number|null>(null);
  const invoiceTrigger=useRef<HTMLButtonElement|null>(null);
  const [customerId, setCustomerId] = useState("all");
  const [currencyCode,setCurrencyCode]=useState(currency);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);

  const filtered = useMemo(() => {
    if (invalidRange) return [];
    return invoices.filter(invoice => {
      const day = invoice.invoiceDate;
      return invoice.currency===currencyCode && (customerId === "all" || String(invoice.customerId) === customerId)
        && (!fromDate || day >= fromDate)
        && (!toDate || day <= toDate);
    });
  }, [currencyCode, customerId, fromDate, invalidRange, invoices, toDate]);

  const totals=useMemo(()=>reportTotals(filtered),[filtered]);
  const selectedCustomer = customers.find(customer => String(customer.id) === customerId);
  const hasFilters = customerId !== "all" || currencyCode!==currency || Boolean(fromDate) || Boolean(toDate);

  function clearFilters() {
    setCustomerId("all");
    setCurrencyCode(currency);
    setFromDate("");
    setToDate("");
  }

  const details={companyName,currency:currencyCode,customer:selectedCustomer?`${selectedCustomer.code}  -  ${selectedCustomer.name}`:'All customers',fromDate,toDate};
  const blocked=loading||!!error||invalidRange||!filtered.length;
  async function exportExcel(){
    setExporting(true);
    try{
      const {invoiceReportWorkbook}=await import('@/lib/invoice-report-excel');
      const buffer=await invoiceReportWorkbook(filtered,details);
      const url=URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const link=document.createElement('a');link.href=url;link.download=`invoice-list-${fromDate||'all'}-to-${toDate||'all'}.xlsx`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){toast.error(e instanceof Error?e.message:'Could not export Excel report')}finally{setExporting(false)}
  }
  function printReport(){const old=document.title;document.title=`Invoice list - ${fromDate||'all'} to ${toDate||'all'}`;window.addEventListener('afterprint',()=>{document.title=old},{once:true});window.print();}

  return <div className="space-y-5">
    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><CalendarRange className="size-5"/></span><div><h2 className="font-bold">Invoice list report</h2><p className="text-sm text-slate-500">Choose a customer or leave it set to all customers.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setReload(n=>n+1)} disabled={loading}><RefreshCw/>Refresh</Button><Button variant="outline" onClick={printReport} disabled={blocked}><Printer/>Print / Save PDF</Button><Button onClick={exportExcel} disabled={blocked||exporting} className="bg-[#217346] text-white hover:bg-[#185c37]"><FileSpreadsheet/>{exporting?"Exporting...":"Export Excel"}</Button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_130px_180px_180px_auto] md:items-end">
        <div className="grid gap-1.5"><Label>Customer (optional)</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All customers</SelectItem>{customers.map(customer => <SelectItem key={customer.id} value={String(customer.id)}>{customer.code} · {customer.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label>Currency</Label><Select value={currencyCode} onValueChange={setCurrencyCode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[...new Set(invoices.map(invoice=>invoice.currency).concat(currency))].map(code=><SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor="report-from">From date</Label><Input id="report-from" type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)}/></div>
        <div className="grid gap-1.5"><Label htmlFor="report-to">To date</Label><Input id="report-to" type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></div>
        <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}><FilterX/>Clear</Button>
      </div>
      <p className="mt-3 text-sm text-slate-500">For PDF, choose "Save as PDF" in the print dialog. All amounts are in {currencyCode}.</p>
      {invalidRange&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">The From date must be before the To date.</p>}
    </section>

    {loading?<p role="status" className="rounded-xl border bg-white p-8">Loading the complete invoice list...</p>:error?<div role="alert" className="rounded-xl border bg-white p-8"><p>{error}</p><Button onClick={()=>setReload(n=>n+1)}>Try again</Button></div>:<>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Invoices" value={String(filtered.length)} />
      <Summary label="Gross subtotal" value={money(totals.gross,currencyCode)}/><Summary label="Line discounts" value={money(totals.lineDiscount,currencyCode)}/><Summary label="Net before VAT" value={money(totals.subtotal, currencyCode)} /><Summary label="Additional invoice discount" value={money(totals.discount,currencyCode)}/>
      <Summary label="VAT" value={money(totals.tax, currencyCode)} />
      <Summary label="Total incl. VAT" value={money(totals.total, currencyCode)} accent /><Summary label="Amount due" value={money(totals.due,currencyCode)}/>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><ReceiptText className="size-5"/></span><div><h2 className="font-bold">Invoice list</h2><p className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "invoice" : "invoices"} in this report · Click an invoice to view its details.</p></div></div>
      {filtered.length?<div className="overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Salesman</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Gross subtotal</TableHead><TableHead className="text-right">Line discounts</TableHead><TableHead className="text-right">Additional invoice discount</TableHead><TableHead className="text-right">Net before VAT</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">Total incl. VAT</TableHead><TableHead className="text-right">Due</TableHead></TableRow></TableHeader><TableBody>{filtered.map(invoice => <TableRow key={invoice.id} className="cursor-pointer hover:bg-rose-50/50" onClick={event=>{invoiceTrigger.current=event.currentTarget.querySelector("button");setSelectedInvoiceId(invoice.id)}}><TableCell className="font-mono text-sm font-semibold"><button type="button" className="rounded text-[#b72d50] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={"View details for "+invoice.invoiceNumber} onClick={event=>{event.stopPropagation();invoiceTrigger.current=event.currentTarget;setSelectedInvoiceId(invoice.id)}}>{invoice.invoiceNumber}</button></TableCell><TableCell>{displayDate(invoice.invoiceDate)}</TableCell><TableCell className="font-semibold">{invoice.customerName}<small className="block font-mono text-slate-500">{invoice.customerCode}</small></TableCell><TableCell>{invoice.salesmanName||"—"}</TableCell><TableCell><Badge variant="outline" className={invoice.status === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>{invoice.status==="paid"?"Paid":invoice.appliedAmount>0?"Partial":"Unpaid"}</Badge></TableCell><TableCell className="text-right">{money(invoice.subtotal+(invoice.discountAmount||0)+(invoice.lineDiscountTotal||0),currencyCode)}</TableCell><TableCell className="text-right">{money(invoice.lineDiscountTotal||0,currencyCode)}</TableCell><TableCell className="text-right">{money(invoice.discountAmount||0,currencyCode)}</TableCell><TableCell className="text-right">{money(invoice.subtotal, currencyCode)}</TableCell><TableCell className="text-right">{money(invoice.tax, currencyCode)}</TableCell><TableCell className="text-right font-bold">{money(invoice.total, currencyCode)}</TableCell><TableCell className="text-right font-bold">{money(invoice.status==="paid"?0:invoice.outstanding,currencyCode)}</TableCell></TableRow>)}<TableRow className="bg-slate-50 font-bold"><TableCell colSpan={5}>Totals</TableCell>{[totals.gross,totals.lineDiscount,totals.discount,totals.subtotal,totals.tax,totals.total,totals.due].map((v,n)=><TableCell key={n} className="text-right">{money(v,currencyCode)}</TableCell>)}</TableRow></TableBody></Table></div>:<div className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><ReceiptText/></span><h3 className="font-bold">No invoices found</h3><p className="mt-1 text-sm text-slate-500">Change the currency, customer or date filters to see more invoices.</p></div></div>}
    </section>
    </>}
    <InvoiceDetailDialog invoiceId={selectedInvoiceId} onClose={()=>setSelectedInvoiceId(null)} onReturnFocus={()=>invoiceTrigger.current?.focus()}/>
    {!loading&&!error&&<InvoiceReportPrint invoices={filtered} details={details}/>}
  </div>;
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-[#211b20] bg-[#211b20] text-white" : "border-[#eadfe1] bg-white"}`}><p className={`text-sm ${accent ? "text-white/60" : "text-slate-500"}`}>{label}</p><p className={`mt-2 text-2xl font-bold ${accent ? "text-[#ff9caf]" : ""}`}>{value}</p></div>;
}
