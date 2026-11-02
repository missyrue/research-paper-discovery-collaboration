"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, name, email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not authenticate.");
      router.push(result.user?.role === "Admin" ? "/admin" : "/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/"><span className="brand-mark">a</span><span>atlas<span className="brand-dot">.</span></span></Link>
      <section className="auth-card">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR RESEARCH, IN GOOD COMPANY</div>
        <h1>{mode === "login" ? <>Welcome<br /><em>back.</em></> : <>Join the<br /><em>conversation.</em></>}</h1>
        <p className="auth-intro">{mode === "login" ? "Sign in to pick up where your curiosity left off." : "Create an account to start your research library."}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <><label htmlFor="name">Full name</label><input id="name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} /></>}
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@university.edu" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="At least 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          {error && <p className="auth-notice" role="alert">{error}</p>}
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} <span>↗</span></button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to Atlas? " : "Already have an account? "}<button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
      </section>
      <p className="auth-caption">A quieter place to follow a question.</p>
    </main>
  );
}
