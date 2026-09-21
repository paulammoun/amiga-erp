"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {amountDue,paymentStatus,reportTotals,type ReportInvoice,type ReportDetails} from '@/lib/invoice-report';

export default function InvoiceReportPrint({invoices,details}:{invoices:ReportInvoice[];details:ReportDetails}){
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 if(!mounted)return null;
 const totals=reportTotals(invoices),number=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 return createPortal(<div id="invoice-list-print"><style>{`
 #invoice-list-print{display:none}
 @media print{
  @page{size:A4 landscape;margin:12mm}
  body > :not(#invoice-list-print){display:none!important}
  #invoice-list-print{display:block!important;color:#111;background:white;font:9pt Arial,sans-serif}
  #invoice-list-print h1{font-size:18pt;font-weight:bold;margin-bottom:4mm}
  #invoice-list-print h2{font-size:14pt;font-weight:bold;margin-bottom:3mm}
  #invoice-list-print p{margin:2mm 0}
  #invoice-list-print table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:5mm}
  #invoice-list-print th,#invoice-list-print td{border-bottom:1px solid #bbb;padding:2.5mm 1.5mm;vertical-align:top;overflow-wrap:anywhere}
  #invoice-list-print th{text-align:left;border-top:1px solid #333;font-weight:bold}
  #invoice-list-print th:nth-child(n+5),#invoice-list-print td:nth-child(n+5){text-align:right;font-variant-numeric:tabular-nums}
  #invoice-list-print thead{display:table-header-group}
  #invoice-list-print tr{break-inside:avoid}
  #invoice-list-print .totals{font-weight:bold;border-top:2px solid #333}
  #invoice-list-print .totals td:not(:first-child){text-align:right}
  #invoice-list-print small{display:block;color:#444}
 }
 `}</style><h1>{details.companyName}</h1><h2>Invoice list report</h2><p>{details.customer} · From: {details.fromDate||'All dates'} · To: {details.toDate||'All dates'}</p><p>{invoices.length} invoices · Currency: {details.currency}</p><table><colgroup><col style={{width:'12%'}}/><col style={{width:'10%'}}/><col style={{width:'16%'}}/><col style={{width:'6%'}}/>{Array.from({length:7},(_,n)=><col key={n} style={{width:'8%'}}/>)}</colgroup><thead><tr>{['Invoice','Date','Customer','Status','Gross subtotal','Line discounts','Additional invoice discount','Net before VAT','VAT','Total incl. VAT','Due'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td>{i.invoiceNumber}</td><td>{i.invoiceDate}</td><td>{i.customerName}<small>{i.customerCode}</small></td><td>{paymentStatus(i)}</td>{[i.subtotal+(i.discountAmount||0)+(i.lineDiscountTotal||0),i.lineDiscountTotal||0,i.discountAmount||0,i.subtotal,i.tax,i.total,amountDue(i)].map((v,n)=><td key={n}>{number(v)}</td>)}</tr>)}<tr className="totals"><td colSpan={4}>Totals</td>{[totals.gross,totals.lineDiscount,totals.discount,totals.subtotal,totals.tax,totals.total,totals.due].map((v,n)=><td key={n}>{number(v)}</td>)}</tr></tbody></table></div>,document.body);
}
