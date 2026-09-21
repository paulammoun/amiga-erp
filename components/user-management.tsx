"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuthUser } from "./auth-types";

type ManagedUser = AuthUser & { createdAt: string };

export default function UserManagement({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/users");
      const data = await response.json() as { users?: ManagedUser[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load users");
      setUsers(data.users ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load users"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (currentUser.role === "admin") void loadUsers(); }, [currentUser.role]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setSaving(true);
    try {
      const response = await fetch("/api/auth/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: `${currentUser.companyCode}.${username}`, companyCode: currentUser.companyCode, password, role }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create user");
      setUsername(""); setPassword(""); setRole("user"); setMessage("User created"); await loadUsers();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create user"); }
    finally { setSaving(false); }
  }

  if (currentUser.role !== "admin") return null;
  return <section className="mx-auto mt-6 grid max-w-4xl gap-5 rounded-2xl border border-[#eadfe1] bg-white p-5 shadow-sm md:p-6">
    <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Users className="size-5"/></span><div><h2 className="font-bold">User accounts</h2><p className="text-sm text-slate-500">Create login accounts for your workshop team.</p></div></div>
    <form onSubmit={submit} className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_180px_auto] md:items-end"><div className="grid gap-1.5"><Label htmlFor="new-username">Username</Label><div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-500">{currentUser.companyCode}.</span><Input id="new-username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={username} onChange={event => setUsername(event.target.value)} placeholder="technician"/></div></div><div className="grid gap-1.5"><Label htmlFor="new-password">Temporary password</Label><Input id="new-password" required minLength={8} maxLength={200} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></div><div className="grid gap-1.5"><Label>Access</Label><Select value={role} onValueChange={(value: "user" | "admin") => setRole(value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="user">Staff</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent></Select></div><Button disabled={saving} className="bg-[#ef4e6f] hover:bg-[#c93454]"><UserPlus/>{saving?"Creating…":"Create user"}</Button></form>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
    <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600"><ShieldCheck className="size-4"/>Accounts</div>{loading?<p className="text-sm text-slate-500">Loading users…</p>:<div className="divide-y rounded-xl border">{users.map(user=><div key={user.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium">{user.username}</p><p className="text-xs text-slate-500">{user.role==="admin"?"Administrator":"Staff"}</p></div><span className="text-xs text-slate-500">Added {new Date(user.createdAt).toLocaleDateString()}</span></div>)}</div>}</div>
  </section>;
}
