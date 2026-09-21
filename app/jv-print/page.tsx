"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./print.css";

type Voucher={transactionType:string;sourceId:number;transactionDate:string;reference:string;currency:string;debitLocal:number;creditLocal:number;externalReference:string;voucherNotes:string};
type Line={id:number;accountNumber:string;accountName:string;currency:string;amountCurrency:number;amountLocalCurrency:number;indicator:"debit"|"credit";notes:string};
type Settings={companyName:string;companyAddress:string;logoDataUrl:string;localCurrency:string};
type Data={voucher:Voucher;lines:Line[];settings:Settings};
const number=(value:number)=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const source=(value:string)=>value==="sale"?"Sales invoice":value==="purchase"?"Purchase invoice":value==="journal"?"Manual journal":value;

export default function JournalVoucherPrint(){
 const[data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController(),params=new URLSearchParams(window.location.search),type=params.get("type")??"",sourceId=params.get("sourceId")??"";setData(null);setError("");if(!type||!/^\d+$/.test(sourceId)){setError("Choose a journal voucher from the JV page.");return}fetch(`/api/journal-vouchers?type=${encodeURIComponent(type)}&sourceId=${encodeURIComponent(sourceId)}`,{signal:controller.signal}).then(async response=>{const value=await response.json() as Data&{error?:string};if(!response.ok)throw new Error(value.error||"Could not load journal voucher.");setData(value);document.title=`${value.voucher.reference} — ${value.settings.companyName}`}).catch(reason=>{if(reason.name!=="AbortError")setError(reason.message)});return()=>controller.abort()},[retry]);
 return <main className="jv-print-page">
  <nav className="jv-toolbar" aria-label="Journal voucher print controls"><Link href="/">Back to workshop</Link><button disabled={!data} onClick={()=>window.print()}>Print / Save as PDF</button></nav>
  {error?<section className="jv-message" role="alert"><h1>Journal voucher unavailable</h1><p>{error}</p><button onClick={()=>setRetry(value=>value+1)}>Try again</button></section>:!data?<p className="jv-message" role="status">Loading journal voucher…</p>:<article className="jv-paper">
   <header className="jv-heading"><div className="jv-company">{data.settings.logoDataUrl&&<img src={data.settings.logoDataUrl} alt=""/>}<div><h1>{data.settings.companyName}</h1>{data.settings.companyAddress&&<p className="preserve-lines">{data.settings.companyAddress}</p>}</div></div><div className="jv-identity"><span>JOURNAL VOUCHER</span><strong>{data.voucher.reference}</strong><time>{new Date(data.voucher.transactionDate+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</time></div></header>
   <section className="jv-meta"><div><span>Source</span><strong>{source(data.voucher.transactionType)}</strong></div><div><span>External reference</span><strong>{data.voucher.externalReference||"—"}</strong></div><div><span>Transaction currencies</span><strong>{data.voucher.currency}</strong></div><div><span>Local currency</span><strong>{data.settings.localCurrency}</strong></div></section>
   <table className="jv-lines"><caption>Accounting entries</caption><thead><tr><th>Account</th><th>Description</th><th>Currency</th><th className="number">Debit</th><th className="number">Credit</th><th className="number">Debit local</th><th className="number">Credit local</th></tr></thead><tbody>{data.lines.map(line=><tr key={line.id}><td><strong>{line.accountNumber}</strong><small>{line.accountName}</small></td><td>{line.notes||"—"}</td><td>{line.currency}</td><td className="number">{line.indicator==="debit"?number(line.amountCurrency):"—"}</td><td className="number">{line.indicator==="credit"?number(line.amountCurrency):"—"}</td><td className="number">{line.indicator==="debit"?number(line.amountLocalCurrency):"—"}</td><td className="number">{line.indicator==="credit"?number(line.amountLocalCurrency):"—"}</td></tr>)}</tbody><tfoot><tr><th colSpan={5}>Totals · {data.settings.localCurrency}</th><th className="number">{number(data.voucher.debitLocal)}</th><th className="number">{number(data.voucher.creditLocal)}</th></tr></tfoot></table>
   <section className="jv-balance"><span>{Math.abs(data.voucher.debitLocal-data.voucher.creditLocal)<0.005?"Balanced in local currency":"Unbalanced"}</span><strong>Difference: {number(data.voucher.debitLocal-data.voucher.creditLocal)} {data.settings.localCurrency}</strong></section>
   {data.voucher.voucherNotes&&<section className="jv-notes"><h2>Notes</h2><p className="preserve-lines">{data.voucher.voucherNotes}</p></section>}
   <footer className="jv-signatures"><div>Prepared by</div><div>Reviewed by</div><div>Approved by</div></footer>
  </article>}
 </main>
}
