"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Coins, ImageUp, ReceiptText, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkshopSettings } from "../db/settings";
import AccountSetup from "./account-setup";
import CurrencyRegister, { type Currency } from "./currency-register";

export default function Configuration({ settings, currencies, onSaved, onCurrenciesChanged=()=>window.location.reload() }: { settings: WorkshopSettings; currencies: Currency[]; onSaved: (settings: WorkshopSettings) => void; onCurrenciesChanged?:()=>void }) {
  const [accounts,setAccounts]=useState<{accountNumber:string;name:string}[]>([]);
  useEffect(()=>{fetch("/api/accounts?posting=1").then(r=>r.json() as Promise<{accounts?:{accountNumber:string;name:string}[]}>).then(d=>setAccounts(d.accounts??[])).catch(()=>setError("Could not load posting accounts."))},[]);
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setForm(settings), [settings]);
  const activeCurrencies=currencies.filter(currency=>currency.active||currency.code===form.defaultCurrency||currency.code===form.localCurrency);

  function chooseLogo(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 500_000) {
      setError("Upload a PNG, JPG, or WebP logo smaller than 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setForm(current => ({ ...current, logoDataUrl: reader.result as string })); };
    reader.onerror = () => setError("Could not read the selected logo");
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json() as { settings?: WorkshopSettings; error?: string };
      if (!response.ok || !data.settings) throw new Error(data.error || "Could not save configuration");
      setForm(data.settings);
      onSaved(data.settings);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save configuration"); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto grid max-w-4xl gap-5"><AccountSetup/>
      <CurrencyRegister data={currencies} query="" localCurrency={settings.localCurrency} onSaved={onCurrenciesChanged}/><form onSubmit={submit} className="grid gap-5">
    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="size-5"/></span><div><h2 className="font-bold">Company details</h2><p className="text-sm text-slate-500">Shown at the top of printed invoices.</p></div></div>
      <div className="grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="company-name">Company name</Label><Input id="company-name" required maxLength={200} value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })}/></div>
        <div className="grid gap-1.5"><Label htmlFor="company-address">Company address</Label><Textarea id="company-address" maxLength={2000} rows={3} value={form.companyAddress} onChange={event => setForm({ ...form, companyAddress: event.target.value })}/></div>
        <div className="grid gap-1.5"><Label htmlFor="seller-tax-registration">Seller tax registration / MOF</Label><Input id="seller-tax-registration" maxLength={100} value={form.sellerTaxRegistration} onChange={event=>setForm({...form,sellerTaxRegistration:event.target.value})} placeholder="Tax registration or MOF number"/></div>
      </div>
    </section>

    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#fff0f3] text-[#c93454]"><Wrench className="size-5"/></span><div><h2 className="font-bold">Overview message</h2><p className="text-sm text-slate-500">Customize the welcome message shown on your home page.</p></div></div>
      <div className="grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="overview-kicker">Small heading</Label><Input id="overview-kicker" maxLength={60} value={form.overviewKicker} onChange={event=>setForm({...form,overviewKicker:event.target.value})} placeholder="BUSINESS DESK"/></div>
        <div className="grid gap-1.5"><Label htmlFor="overview-title">Main message</Label><Input id="overview-title" required maxLength={160} value={form.overviewTitle} onChange={event=>setForm({...form,overviewTitle:event.target.value})} placeholder="Ready for your next sale."/></div>
        <div className="grid gap-1.5"><Label htmlFor="overview-description">Description</Label><Textarea id="overview-description" maxLength={500} rows={3} value={form.overviewDescription} onChange={event=>setForm({...form,overviewDescription:event.target.value})} placeholder="Create invoices, track items and serve customers from one place."/></div>
      </div>
    </section>

    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><ImageUp className="size-5"/></span><div><h2 className="font-bold">Main menu branding</h2><p className="text-sm text-slate-500">Customize the logo and name shown at the top of the menu.</p></div></div>
      <div className="grid gap-5 md:grid-cols-[160px_1fr]">
        <div className="grid content-start gap-3">
          <div className="grid h-28 place-items-center overflow-hidden rounded-2xl border bg-[#211b20] p-4">{form.logoDataUrl?<img src={form.logoDataUrl} alt="Logo preview" className="max-h-20 max-w-full object-contain"/>:<span className="grid size-14 place-items-center rounded-2xl bg-[#fd657e] text-[#211b20]"><Wrench className="size-7"/></span>}</div>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium shadow-xs hover:bg-slate-50"><ImageUp className="size-4"/>Choose logo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>{chooseLogo(event.currentTarget.files?.[0]);event.currentTarget.value=""}}/></label>
          {form.logoDataUrl&&<Button type="button" size="sm" variant="ghost" onClick={()=>setForm({...form,logoDataUrl:""})}><Trash2/>Remove logo</Button>}
          <p className="text-xs text-slate-500">PNG, JPG or WebP. Maximum 500 KB.</p>
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-1.5"><Label htmlFor="menu-name">Menu name</Label><Input id="menu-name" required maxLength={60} value={form.menuName} onChange={event=>setForm({...form,menuName:event.target.value})} placeholder="Workshop"/></div>
          <div className="grid gap-1.5"><Label htmlFor="menu-subtitle">Menu subtitle</Label><Input id="menu-subtitle" maxLength={100} value={form.menuSubtitle} onChange={event=>setForm({...form,menuSubtitle:event.target.value})} placeholder="Service desk"/></div>
          <div className="rounded-xl bg-[#211b20] px-4 py-3 text-white"><p className="truncate font-bold">{form.menuName||"Menu name"}</p><p className="truncate text-sm text-white/50">{form.menuSubtitle||"Menu subtitle"}</p></div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><ReceiptText className="size-5"/></span><div><h2 className="font-bold">Accounting and invoice defaults</h2><p className="text-sm text-slate-500">Set invoice defaults and the ledger accounts used for sales and purchases.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="default-tax">Default tax (%)</Label><Input id="default-tax" required type="number" min="0" max="100" step="any" value={form.defaultTax} onChange={event => setForm({ ...form, defaultTax: Number(event.target.value) })}/></div>
        <div className="grid gap-1.5"><Label>Negative stock at posting</Label><Select value={form.negativeStockPolicy} onValueChange={(negativeStockPolicy:"warn"|"block")=>setForm({...form,negativeStockPolicy})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="warn">Warn and require acknowledgement</SelectItem><SelectItem value="block">Block posting</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Checks the total requested quantity per item across the invoice.</p></div>
        <div className="grid gap-1.5"><Label>Default currency</Label><Select value={form.defaultCurrency} onValueChange={defaultCurrency=>setForm({...form,defaultCurrency})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{activeCurrencies.map(currency=><SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-500">Used as the default on new invoices and purchases.</p></div>
        <div className="grid gap-1.5"><Label htmlFor="sales-account-number">Sales ledger account</Label><Select value={form.salesAccountNumber||"none"} onValueChange={value=>setForm({...form,salesAccountNumber:value==="none"?"":value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Not configured</SelectItem>{form.salesAccountNumber&&!accounts.some(a=>a.accountNumber===form.salesAccountNumber)&&<SelectItem disabled value={form.salesAccountNumber}>{form.salesAccountNumber} · needs review</SelectItem>}{accounts.map(a=><SelectItem key={a.accountNumber} value={a.accountNumber}>{a.accountNumber} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor="tax-account-number">Tax ledger account</Label><Select value={form.taxAccountNumber||"none"} onValueChange={value=>setForm({...form,taxAccountNumber:value==="none"?"":value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Not configured</SelectItem>{form.taxAccountNumber&&!accounts.some(a=>a.accountNumber===form.taxAccountNumber)&&<SelectItem disabled value={form.taxAccountNumber}>{form.taxAccountNumber} · needs review</SelectItem>}{accounts.map(a=><SelectItem key={a.accountNumber} value={a.accountNumber}>{a.accountNumber} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor="purchase-account-number">Purchase ledger account</Label><Select value={form.purchaseAccountNumber||"none"} onValueChange={value=>setForm({...form,purchaseAccountNumber:value==="none"?"":value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Not configured</SelectItem>{form.purchaseAccountNumber&&!accounts.some(a=>a.accountNumber===form.purchaseAccountNumber)&&<SelectItem disabled value={form.purchaseAccountNumber}>{form.purchaseAccountNumber} · needs review</SelectItem>}{accounts.map(a=><SelectItem key={a.accountNumber} value={a.accountNumber}>{a.accountNumber} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor="purchase-tax-account-number">Purchase tax ledger</Label><Select value={form.purchaseTaxAccountNumber||"none"} onValueChange={value=>setForm({...form,purchaseTaxAccountNumber:value==="none"?"":value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Not configured</SelectItem>{form.purchaseTaxAccountNumber&&!accounts.some(a=>a.accountNumber===form.purchaseTaxAccountNumber)&&<SelectItem disabled value={form.purchaseTaxAccountNumber}>{form.purchaseTaxAccountNumber} · needs review</SelectItem>}{accounts.map(a=><SelectItem key={a.accountNumber} value={a.accountNumber}>{a.accountNumber} · {a.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
    </section>

    <section className="rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Coins className="size-5"/></span><div><h2 className="font-bold">Local currency</h2><p className="text-sm text-slate-500">Currency rates are maintained in Currency master data.</p></div></div>
      <div className="grid gap-1.5"><Label>Local currency</Label><Select value={form.localCurrency} onValueChange={localCurrency=>setForm({...form,localCurrency})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{activeCurrencies.map(currency=><SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-500">The local currency always has a rate of 1.</p></div>
    </section>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end"><Button disabled={saving} className="min-w-40 bg-[#ef4e6f] hover:bg-[#c93454]">{saving ? "Saving…" : "Save configuration"}</Button></div>
  </form></div>;
}
