"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, ChevronRight, KeyRound, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuthUser } from "./auth-types";

type Company = { id: number; code: string; name: string; userCount: number; adminCount: number; createdAt: string };
type CompanyUser = { id: number; username: string; companyCode: string; role: "superadmin" | "admin" | "user"; createdAt: string };

export default function CompanyManagement({ currentUser }: { currentUser: AuthUser }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetUser, setResetUser] = useState<CompanyUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/companies");
      const data = await response.json() as { companies?: Company[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load companies");
      setCompanies(data.companies ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load companies"); }
    finally { setLoading(false); }
  }

  async function selectCompany(company: Company) {
    setSelectedCompany(company);
    setLoadingUsers(true);
    setUserError("");
    setUserMessage("");
    try {
      const response = await fetch(`/api/auth/companies?companyCode=${encodeURIComponent(company.code)}`);
      const data = await response.json() as { users?: CompanyUser[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load company users");
      setCompanyUsers(data.users ?? []);
    } catch (cause) {
      setCompanyUsers([]);
      setUserError(cause instanceof Error ? cause.message : "Could not load company users");
    } finally { setLoadingUsers(false); }
  }

  useEffect(() => { if (currentUser.role === "superadmin") void load(); }, [currentUser.role]);
  if (currentUser.role !== "superadmin") return null;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const response = await fetch("/api/auth/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name, username, password }) });
      const data = await response.json() as { error?: string; user?: { username: string } };
      if (!response.ok) throw new Error(data.error || "Could not create company");
      setMessage(`Company created. Administrator login: ${data.user?.username || `${code}.${username}`}`);
      setCode(""); setName(""); setUsername(""); setPassword(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create company"); }
    finally { setSaving(false); }
  }

  async function resetUserPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    setUserError(""); setUserMessage("");
    if (resetPassword !== confirmPassword) { setUserError("Passwords do not match"); return; }
    setResetting(true);
    try {
      const response = await fetch("/api/auth/companies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: resetUser.id, password: resetPassword }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "Could not reset the password");
      setUserMessage(`Password reset for ${resetUser.username}. Existing sessions were signed out.`);
      setResetUser(null); setResetPassword(""); setConfirmPassword("");
    } catch (cause) { setUserError(cause instanceof Error ? cause.message : "Could not reset the password"); }
    finally { setResetting(false); }
  }

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="size-5"/></span><div><h2 className="font-bold">Companies</h2><p className="text-sm text-slate-500">Select a company to view and manage its users.</p></div></div>
      {loading ? <p className="p-8 text-center text-slate-500">Loading companies…</p> : companies.length ? <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Company</TableHead><TableHead className="text-right">Administrators</TableHead><TableHead className="text-right">Users</TableHead><TableHead>Created</TableHead><TableHead><span className="sr-only">Select company</span></TableHead></TableRow></TableHeader>
        <TableBody>{companies.map(company => <TableRow key={company.id} data-state={selectedCompany?.id === company.id ? "selected" : undefined}><TableCell className="font-mono font-semibold">{company.code}</TableCell><TableCell className="font-semibold">{company.name}</TableCell><TableCell className="text-right">{company.adminCount}</TableCell><TableCell className="text-right">{company.userCount}</TableCell><TableCell>{new Date(company.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}</TableCell><TableCell className="text-right"><Button size="sm" variant={selectedCompany?.id === company.id ? "default" : "outline"} onClick={() => void selectCompany(company)}>Users<ChevronRight/></Button></TableCell></TableRow>)}</TableBody>
      </Table> : <p className="p-8 text-center text-slate-500">No companies yet.</p>}
    </section>

    {selectedCompany && <section className="overflow-hidden rounded-2xl border border-[#eadfe1] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#fff0f3] text-[#c93454]"><Users className="size-5"/></span><div><h2 className="font-bold">{selectedCompany.name} users</h2><p className="text-sm text-slate-500">{selectedCompany.code} · {companyUsers.length} account{companyUsers.length === 1 ? "" : "s"}</p></div></div>
      {userError && <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{userError}</p>}
      {userMessage && <p role="status" className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{userMessage}</p>}
      {loadingUsers ? <p className="p-8 text-center text-slate-500">Loading users…</p> : companyUsers.length ? <Table>
        <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Access</TableHead><TableHead>Created</TableHead><TableHead><span className="sr-only">Password action</span></TableHead></TableRow></TableHeader>
        <TableBody>{companyUsers.map(user => <TableRow key={user.id}><TableCell><span className="flex items-center gap-2 font-semibold">{user.role === "superadmin" ? <ShieldCheck className="size-4 text-[#c93454]"/> : <UserRound className="size-4 text-slate-400"/>}{user.username}</span></TableCell><TableCell>{user.role === "user" ? "Staff" : user.role === "superadmin" ? "Super administrator" : "Administrator"}</TableCell><TableCell>{new Date(user.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}</TableCell><TableCell className="text-right">{user.role === "superadmin" ? <span className="text-xs font-medium text-slate-500">Fixed account</span> : <Button size="sm" variant="outline" onClick={() => { setUserError(""); setUserMessage(""); setResetUser(user); }}><KeyRound/>Reset password</Button>}</TableCell></TableRow>)}</TableBody>
      </Table> : <p className="p-8 text-center text-slate-500">No users in this company.</p>}
    </section>}

    <section className="grid gap-5 rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Users className="size-5"/></span><div><h2 className="font-bold">Create a company</h2><p className="text-sm text-slate-500">Create the company and its first administrator account together.</p></div></div><form onSubmit={submit} className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="company-code">Company code</Label><Input id="company-code" required minLength={2} maxLength={20} pattern="[A-Za-z0-9-]+" value={code} onChange={event => setCode(event.target.value.toLowerCase())} placeholder="cp2"/></div><div className="grid gap-1.5"><Label htmlFor="company-name">Company name</Label><Input id="company-name" required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="Second company"/></div><div className="grid gap-1.5"><Label htmlFor="company-admin">Administrator username</Label><div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-500">{code || "cp2"}.</span><Input id="company-admin" required minLength={3} maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={username} onChange={event => setUsername(event.target.value)} placeholder="admin"/></div></div><div className="grid gap-1.5"><Label htmlFor="company-password">Administrator password</Label><Input id="company-password" required minLength={8} maxLength={200} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></div><div className="md:col-span-2"><Button disabled={saving} className="bg-[#ef4e6f] hover:bg-[#c93454]"><Plus/>{saving ? "Creating…" : "Create company"}</Button></div></form>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}</section>

    <Dialog open={!!resetUser} onOpenChange={open => { if (!open && !resetting) { setResetUser(null); setResetPassword(""); setConfirmPassword(""); } }}><DialogContent><form onSubmit={resetUserPassword}><DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a new password for {resetUser?.username}. Their existing sessions will be signed out.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-1.5"><Label htmlFor="reset-password">New password</Label><Input id="reset-password" required minLength={8} maxLength={200} type="password" autoComplete="new-password" value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="At least 8 characters"/></div><div className="grid gap-1.5"><Label htmlFor="confirm-reset-password">Confirm new password</Label><Input id="confirm-reset-password" required minLength={8} maxLength={200} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></div></div><DialogFooter><Button type="button" variant="outline" disabled={resetting} onClick={() => { setResetUser(null); setResetPassword(""); setConfirmPassword(""); }}>Cancel</Button><Button disabled={resetting} className="bg-[#ef4e6f] hover:bg-[#c93454]"><KeyRound/>{resetting ? "Resetting…" : "Reset password"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
