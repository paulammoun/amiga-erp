"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./print.css";

type Receipt = {
  receiptNumber: string;
  receiptDate: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  customerName: string;
  customerCode: string;
  customerMofNumber: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  accountNumber: string;
  advanceBalance: number;
};
type Settings = { companyName: string; companyAddress: string; logoDataUrl: string; defaultCurrency: string };
type Allocation = { invoiceNumber: string; amount: number; invoiceCurrency:string; invoiceDate: string; applicationDate: string; applicationType: "receipt" | "advance" };
type Data = { receipt: Receipt; allocations: Allocation[]; settings: Settings };
const methodLabel = (value: string) => ({ cash: "Cash", card: "Card", bank_transfer: "Bank transfer", check: "Check", other: "Other" } as Record<string,string>)[value] ?? value;
const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "LBP" ? 0 : 2 }).format(value);

export default function ReceiptPrint() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^\d+$/.test(id)) { queueMicrotask(()=>setError("Choose a receipt from the Customer receipts page.")); return; }
    fetch(`/api/receipts?id=${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => {
      const value = await response.json() as Data & { error?: string };
      if (!response.ok) throw new Error(value.error || "Could not load receipt.");
      setData(value);
      document.title = `${value.receipt.receiptNumber} — ${value.settings.companyName}`;
    }).catch(reason => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [retry]);

  return <main className="receipt-print-page">
    <nav className="receipt-toolbar" aria-label="Receipt print controls"><Link href="/">Back to workshop</Link><button disabled={!data} onClick={()=>window.print()}>Print / Save as PDF</button></nav>
    {error?<section className="receipt-message" role="alert"><h1>Receipt unavailable</h1><p>{error}</p><button onClick={()=>{setError("");setData(null);setRetry(value=>value+1)}}>Try again</button></section>:!data?<p className="receipt-message" role="status">Loading receipt…</p>:<article className="receipt-paper">
      <header className="receipt-heading"><div className="company-block">{data.settings.logoDataUrl&&<img src={data.settings.logoDataUrl} alt=""/>}<div><h1>{data.settings.companyName}</h1>{data.settings.companyAddress&&<p className="preserve-lines">{data.settings.companyAddress}</p>}</div></div><div className="receipt-identity"><span>PAYMENT RECEIPT</span><strong>{data.receipt.receiptNumber}</strong><time>{new Date(data.receipt.receiptDate+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</time></div></header>
      <section className="received-from"><p className="eyebrow">Received from</p><h2>{data.receipt.customerName}</h2><div className="customer-details"><p>Customer code: <strong>{data.receipt.customerCode}</strong></p>{data.receipt.customerMofNumber&&<p>MOF number: <strong>{data.receipt.customerMofNumber}</strong></p>}{data.receipt.customerPhone&&<p>{data.receipt.customerPhone}</p>}{data.receipt.customerEmail&&<p>{data.receipt.customerEmail}</p>}{data.receipt.customerAddress&&<p className="preserve-lines">{data.receipt.customerAddress}</p>}</div></section>
      <section className="amount-panel"><p>Amount received</p><strong>{money(data.receipt.amount,data.receipt.currency)}</strong><span>{data.receipt.currency}</span></section>
      <section className="payment-details"><div><span>Payment method</span><strong>{methodLabel(data.receipt.paymentMethod)}</strong></div><div><span>Reference</span><strong>{data.receipt.reference||"—"}</strong></div></section>
      {(!!data.allocations.length||data.receipt.advanceBalance>0)&&<section className="receipt-notes"><h3>Invoice applications</h3>{data.allocations.map((invoice,index)=><p key={index}>{invoice.invoiceNumber} · {money(invoice.amount,invoice.invoiceCurrency)}{invoice.applicationType==="advance"?" · advance applied "+invoice.applicationDate:""}</p>)}<p>Paid in advance available: {money(data.receipt.advanceBalance,data.receipt.currency)}</p></section>}
      {data.receipt.notes&&<section className="receipt-notes"><h3>Notes</h3><p className="preserve-lines">{data.receipt.notes}</p></section>}
      <footer className="signature-row"><div><span>Received by</span></div><div><span>Customer signature</span></div></footer>
    </article>}
  </main>;
}
