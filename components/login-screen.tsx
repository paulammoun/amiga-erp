"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LogIn, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser } from "./auth-types";

export default function LoginScreen({ setupRequired, onAuthenticated }: { setupRequired: boolean; onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = username.trim().toLowerCase() === "superadmin";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (setupRequired && password !== confirmPassword) { setError("Passwords do not match"); return; }
    setSaving(true);
    try {
      const loginUsername = isSuperAdmin ? "superadmin" : `${companyCode}.${username}`;
      const response = await fetch(setupRequired ? "/api/auth/users" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: setupRequired ? username : loginUsername, password, ...(setupRequired ? { companyCode, role: "admin" } : {}) }) });
      const data = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "Could not sign in");
      onAuthenticated(data.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in"); }
    finally { setSaving(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#faf6f7] px-4 py-10 text-[#211b20]">
    <section className="w-full max-w-md rounded-3xl border border-[#eadfe1] bg-white p-7 shadow-xl shadow-slate-900/5 md:p-9">
      <div className="mb-8 text-center"><span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#211b20] text-[#ff9caf]"><Wrench className="size-7"/></span><h1 className="text-2xl font-bold">Auto Workshop</h1><p className="mt-1 text-sm text-slate-500">{setupRequired ? "Create the first super administrator" : "Sign in to your workshop desk"}</p></div>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-1.5"><Label htmlFor="login-company-code">Company code <span className="font-normal text-slate-400">(not needed for super-admin)</span></Label><Input id="login-company-code" required={!isSuperAdmin} minLength={2} maxLength={20} pattern="[A-Za-z0-9-]+" value={companyCode} onChange={event => setCompanyCode(event.target.value.toLowerCase())} placeholder="e.g. cp1"/></div>
        <div className="grid gap-1.5"><Label htmlFor="login-username">{setupRequired?"Administrator username":"Username"}</Label><div className="flex items-center gap-2">{!isSuperAdmin&&<span className="text-sm text-slate-500">{companyCode||"cp1"}.</span>}<Input id="login-username" required minLength={3} maxLength={50} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="admin or superadmin"/></div></div>
        <div className="grid gap-1.5"><Label htmlFor="login-password">Password</Label><Input id="login-password" required minLength={8} maxLength={200} type="password" autoComplete={setupRequired ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></div>
        {setupRequired&&<div className="grid gap-1.5"><Label htmlFor="login-confirm-password">Confirm password</Label><Input id="login-confirm-password" required minLength={8} maxLength={200} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></div>}
        {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <Button disabled={saving} className="h-11 bg-[#ef4e6f] text-white hover:bg-[#c93454]"><>{setupRequired?<UserPlus/>:<LogIn/>}</>{saving?(setupRequired?"Creating account…":"Signing in…"):(setupRequired?"Create administrator":"Sign in")}</Button>
      </form>
      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><KeyRound className="size-3.5"/>Passwords are protected with secure hashing.</p>
    </section>
  </main>;
}
