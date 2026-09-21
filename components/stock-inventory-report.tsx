"use client";

import {WarehouseSelect} from './warehouses';
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: number; sku: string; name: string; brand: string;
  openingQty: number; periodIn: number; periodOut: number;
  closingQty: number; averageCost: number | null;
};
type Report = { warehouseCode:string; from: string; to: string; companyName: string; currency: string; items: Row[] };
const today = () => { const date = new Date(), offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); };
const firstDay = () => today().slice(0, 8) + "01";
const quantity = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
const csvCell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function StockInventoryReport() {
  const [warehouseCode,setWarehouseCode]=useState('');
  const [from, setFrom] = useState(firstDay), [to, setTo] = useState(today);
  const [run, setRun] = useState(0), [query, setQuery] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/stock-inventory?${new URLSearchParams({ from, to,warehouseCode })}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as Report & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not prepare the stock inventory report.");
        if (!controller.signal.aborted) setReport(data);
      })
      .catch(cause => { if (!controller.signal.aborted) { setReport(null); setError(cause instanceof Error ? cause.message : "Could not prepare the stock inventory report."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [run,warehouseCode]);

  const rows = useMemo(() => (report?.items ?? [])
    .filter(row => `${row.sku} ${row.name} ${row.brand}`.toLowerCase().includes(query.toLowerCase()))
    .map(row => ({
      ...row,
      inventoryValue: row.averageCost === null ? null : roundMoney(row.closingQty * row.averageCost),
    })), [report, query]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    opening: sum.opening + row.openingQty,
    incoming: sum.incoming + row.periodIn,
    outgoing: sum.outgoing + row.periodOut,
    closing: sum.closing + row.closingQty,
    value: sum.value + (row.inventoryValue ?? 0),
    unvalued: sum.unvalued + (row.averageCost === null && row.closingQty !== 0 ? 1 : 0),
    negative: sum.negative + (row.closingQty < 0 ? 1 : 0),
  }), { opening: 0, incoming: 0, outgoing: 0, closing: 0, value: 0, unvalued: 0, negative: 0 }), [rows]);

  function exportCsv() {
    if (!report) return;
    const header = ["Item code", "Item", "Brand", "Opening quantity", "Quantity in", "Quantity out", "Closing quantity", `Average cost (${report.currency})`, `Estimated closing value (${report.currency})`];
    const body = rows.map(row => [row.sku, row.name, row.brand, row.openingQty, row.periodIn, row.periodOut, row.closingQty, row.averageCost ?? "", row.inventoryValue ?? ""]);
    body.push(["TOTAL", "", "", totals.opening, totals.incoming, totals.outgoing, totals.closing, "", roundMoney(totals.value)]);
    const csv = [
      ["Company", report.companyName],
      ["Warehouse",report.warehouseCode||"All warehouses"],
      ["From", report.from],
      ["To", report.to],
      [],
      header,
      ...body,
    ].map(line => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `stock-inventory-${report.from}-to-${report.to}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="border-b p-5"><label className="grid max-w-sm gap-1 text-sm">Warehouse<WarehouseSelect all value={warehouseCode} onChange={setWarehouseCode}/></label></div>
    <div className="flex flex-wrap items-end justify-between gap-4 border p-5">
      <div><h2 className="text-lg font-bold">Stock inventory report</h2><p className="text-sm text-slate-500">{report?.companyName ?? "Company"} · Opening, movement and closing stock in {report?.currency ?? "default currency"}.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1"><Label htmlFor="inventory-from">From</Label><Input id="inventory-from" type="date" value={from} onChange={event => setFrom(event.target.value)}/></div>
        <div className="grid gap-1"><Label htmlFor="inventory-to">To</Label><Input id="inventory-to" type="date" value={to} onChange={event => setTo(event.target.value)}/></div>
        <Button onClick={() => setRun(value => value + 1)} disabled={loading || !from || !to || from > to}><RefreshCw className={loading ? "animate-spin" : ""}/>Generate</Button>
        <Button variant="outline" onClick={exportCsv} disabled={loading || !!error || !rows.length}><Download/>Export CSV</Button>
      </div>
    </div>
    {report && !loading && !error && <div className="border-b bg-slate-50 px-5 py-3 text-sm text-slate-600">Period: {report.from} to {report.to} · Closing balance = opening + quantity in − quantity out.</div>}
    <div className="border-b p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search item code, name or brand" className="pl-9"/></div></div>
    {error ? <p role="alert" className="p-8 text-center text-red-700">{error}</p> : loading ? <p role="status" className="p-8 text-center text-slate-500">Preparing stock inventory…</p> : rows.length ? <div className="overflow-x-auto"><Table className="min-w-[1100px]">
      <TableHeader><TableRow><TableHead>Item code</TableHead><TableHead>Item</TableHead><TableHead>Brand</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Closing</TableHead><TableHead className="text-right">Average cost · {report?.currency}</TableHead><TableHead className="text-right">Estimated value · {report?.currency}</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.id} className={row.closingQty < 0 || (row.closingQty !== 0 && row.averageCost === null) ? "bg-amber-50/60" : ""}>
        <TableCell className="font-mono text-xs font-semibold">{row.sku}</TableCell><TableCell className="font-semibold">{row.name}</TableCell><TableCell>{row.brand || "—"}</TableCell>
        <TableCell className="text-right tabular-nums">{quantity(row.openingQty)}</TableCell><TableCell className="text-right tabular-nums">{quantity(row.periodIn)}</TableCell><TableCell className="text-right tabular-nums">{quantity(row.periodOut)}</TableCell>
        <TableCell className={`text-right font-semibold tabular-nums ${row.closingQty < 0 ? "text-amber-700" : ""}`}>{quantity(row.closingQty)}</TableCell>
        <TableCell className="text-right tabular-nums">{row.averageCost === null ? "No cost recorded" : money(row.averageCost, report?.currency ?? "USD")}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{row.inventoryValue === null ? "—" : money(row.inventoryValue, report?.currency ?? "USD")}</TableCell>
      </TableRow>)}</TableBody>
      <TableFooter><TableRow><TableCell colSpan={3}>{query ? "Filtered total" : "Inventory total"}</TableCell><TableCell className="text-right tabular-nums">{quantity(totals.opening)}</TableCell><TableCell className="text-right tabular-nums">{quantity(totals.incoming)}</TableCell><TableCell className="text-right tabular-nums">{quantity(totals.outgoing)}</TableCell><TableCell className="text-right font-bold tabular-nums">{quantity(totals.closing)}</TableCell><TableCell/><TableCell className="text-right font-bold tabular-nums">{money(roundMoney(totals.value), report?.currency ?? "USD")}</TableCell></TableRow></TableFooter>
    </Table></div> : <p className="p-10 text-center text-slate-500">No items match this report.</p>}
    {!loading && !error && report && <div className="space-y-1 border-t bg-slate-50 px-5 py-4 text-sm text-slate-600">
      <p>Estimated value uses closing quantity × the company-wide weighted average purchase cost recorded through the To date. Opening stock without a cost is excluded from the average.</p>
      {totals.unvalued > 0 && <p className="font-medium text-amber-700">{totals.unvalued} item{totals.unvalued === 1 ? "" : "s"} with closing stock have no recorded purchase cost and are excluded from the value total.</p>}
      {totals.negative > 0 && <p className="font-medium text-amber-700">{totals.negative} item{totals.negative === 1 ? "" : "s"} have negative closing quantity.</p>}
      <p>Undated legacy opening balances are carried into the opening column for historical periods.</p>
    </div>}
  </section>;
}
