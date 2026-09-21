"use client";

import {WarehouseSelect} from './warehouses';
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row={warehouseCode:string;warehouseName:string;baseUnit:string;id:number;itemId:number;sku:string;itemName:string;transactionType:string;reference:string;transactionDate:string;quantity:number;unitCost:number|null;unitSalePrice:number|null;currency:string|null;costAmount:number|null;balance:number;notes:string;createdAt:string};
const labels:Record<string,string>={transfer_in:'Transfer in',transfer_out:'Transfer out',opening:"Opening balance",adjustment:"Stock adjustment",purchase:"Purchase",sale:"Sale",sales_return:"Sales Return",credit_return:"Legacy credit return"};
const quantity=(n:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(n);
const empty="—";
const money=(n:number|null|undefined,currency:string|null)=>n==null?empty:`${new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:4}).format(n)} ${currency??""}`;

export default function StockTransactions({items}:{items:{id:number;sku:string;name:string;stockQty:number}[]}){
 const [warehouseCode,setWarehouseCode]=useState('');
 const [rows,setRows]=useState<Row[]>([]),[itemId,setItemId]=useState("0"),[query,setQuery]=useState(""),[page,setPage]=useState(1),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{setLoading(true);setError("");void (async()=>{try{
   const response=await fetch(`/api/stock-transactions?${new URLSearchParams({warehouseCode,itemId,page:String(page),q:query})}`,{signal:controller.signal}),data=await response.json() as {transactions:Row[];hasMore:boolean;error?:string};
   if(!response.ok)throw new Error(data.error);if(!controller.signal.aborted){setRows(data.transactions);setMore(data.hasMore)}
  }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Could not load stock transactions.")}
  finally{if(!controller.signal.aborted)setLoading(false)}})()},200);
  return()=>{clearTimeout(timer);controller.abort()};
 },[warehouseCode,itemId,query,page,refresh]);
 return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
  <div className="space-y-4 border-b p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Stock transactions</h2><Button variant="outline" onClick={()=>setRefresh(n=>n+1)}>Refresh</Button></div>
   <div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-1.5"><Label>Warehouse</Label><WarehouseSelect all value={warehouseCode} onChange={v=>{setWarehouseCode(v);setPage(1)}}/></div><div className="grid gap-1.5"><Label htmlFor="stock-search">Search item or reference</Label><Input id="stock-search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Item code, name or invoice number"/></div><div className="grid gap-1.5"><Label>Item</Label><Select value={itemId} onValueChange={value=>{setItemId(value);setPage(1)}}><SelectTrigger className="w-full" aria-label="Filter stock by item"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0">All items</SelectItem>{items.map(item=><SelectItem key={item.id} value={String(item.id)}>{item.sku} آ· {item.name}</SelectItem>)}</SelectContent></Select></div></div>
   <p className="text-sm text-slate-500">Newest postings first. Editing a purchase or sale replaces its existing posting. Balance is the item quantity in its warehouse after each posting. Costs show purchase amounts in their original currency; sales and manual adjustments have no recorded purchase cost.</p>
  </div>
  {loading?<p className="p-8 text-center text-slate-500" role="status">Loading stock transactions…</p>:error?<div role="alert" className="p-8 text-center"><p className="mb-3 text-red-700">{error}</p><Button variant="outline" onClick={()=>setRefresh(n=>n+1)}>Try again</Button></div>:!rows.length?<p className="p-8 text-center text-slate-500">No stock transactions match these filters.</p>:<Table><TableHeader><TableRow><TableHead>Date / reference</TableHead><TableHead>Warehouse</TableHead><TableHead>Item</TableHead><TableHead>Transaction</TableHead><TableHead className="text-right">Qty in</TableHead><TableHead className="text-right">Qty out</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Selling price</TableHead><TableHead className="text-right">Purchase amount</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.id}><TableCell><div>{row.transactionDate||"Opening"}</div><div className="text-sm text-slate-500">{row.reference}</div></TableCell><TableCell>{row.warehouseCode}<small className="block text-slate-500">{row.warehouseName}</small></TableCell><TableCell><div className="font-semibold">{row.itemName}</div><div className="text-sm text-slate-500">{row.sku}</div></TableCell><TableCell><div>{labels[row.transactionType]??row.transactionType}</div>{row.notes&&<div className="max-w-64 whitespace-normal text-sm text-slate-500">{row.notes}</div>}</TableCell><TableCell className="text-right tabular-nums">{row.quantity>0?quantity(row.quantity):empty}</TableCell><TableCell className="text-right tabular-nums">{row.quantity<0?quantity(-row.quantity):empty}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${row.balance<0?"text-amber-700":""}`}>{quantity(row.balance)} {row.baseUnit}</TableCell><TableCell className="text-right tabular-nums">{money(row.unitCost,row.currency)}</TableCell><TableCell className="text-right tabular-nums">{money(row.unitSalePrice,row.currency)}</TableCell><TableCell className="text-right tabular-nums">{money(row.costAmount,row.currency)}</TableCell></TableRow>)}</TableBody></Table>}
  <div className="flex items-center justify-between gap-3 border-t p-4"><Button variant="outline" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span className="text-sm text-slate-500">Page {page}</span><Button variant="outline" disabled={loading||!!error||!more} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
 </section>
}
