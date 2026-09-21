"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Download, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyManagement from "@/components/company-management";
import type { AuthUser } from "@/components/auth-types";

export default function SuperAdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth/session").then(async response => {
      const data = await response.json() as { user?: AuthUser | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not check access");
      if (!data.user) { window.location.href = "/"; return; }
      setUser(data.user);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Could not check access")).finally(() => setLoading(false));
  }, []);
  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); window.location.href = "/"; }
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#faf6f7] text-slate-500">Checking super-admin access…</main>;
  if (error) return <main className="grid min-h-screen place-items-center bg-[#faf6f7] p-6"><p className="rounded-xl border bg-white p-6 text-red-700">{error}</p></main>;
  if (!user || user.role !== "superadmin") return <main className="grid min-h-screen place-items-center bg-[#faf6f7] p-6"><section className="max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-4 size-10 text-slate-400"/><h1 className="text-xl font-bold">Super-admin access required</h1><p className="mt-2 text-sm text-slate-500">Company administrators and staff cannot view or create companies.</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-slate-50">Return to the application</Link></section></main>;
  return <main className="min-h-screen bg-[#faf6f7] text-[#211b20]"><header className="border-b bg-[#211b20] text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-5"><span className="grid size-10 place-items-center rounded-xl bg-[#fd657e] text-[#211b20]"><ShieldCheck className="size-5"/></span><div><h1 className="text-xl font-bold">Super administration</h1><p className="text-sm text-white/60">Company access and onboarding</p></div><div className="ml-auto hidden items-center gap-5 text-sm sm:flex"><div className="flex items-center gap-2"><UserRound className="size-4 text-[#fd657e]"/><div><div className="text-[10px] uppercase tracking-wider text-white/40">Signed in as</div><div className="font-semibold">{user.username}</div></div></div><div className="flex items-center gap-2"><Building2 className="size-4 text-[#fd657e]"/><div><div className="text-[10px] uppercase tracking-wider text-white/40">Company</div><div className="font-semibold">All companies</div></div></div></div><Button onClick={signOut} variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><LogOut/>Sign out</Button><div className="flex w-full items-center gap-4 border-t border-white/10 pt-3 text-xs sm:hidden"><span className="flex items-center gap-1.5"><UserRound className="size-3.5 text-[#fd657e]"/>{user.username}</span><span className="flex items-center gap-1.5"><Building2 className="size-3.5 text-[#fd657e]"/>All companies</span></div></div></header><div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8"><section className="flex flex-col gap-4 rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Database backup</h2><p className="mt-1 text-sm text-slate-500">Download a complete SQL backup. In Navicat, run this file against a new SQLite database.</p></div><a href="/api/admin/database-export" download className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#ef4e6f] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#c93454]"><Download className="size-4"/>Download SQL backup</a></section><CompanyManagement currentUser={user}/></div></main>;
}
