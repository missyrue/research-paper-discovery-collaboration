"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Paper = { paper_id: number; title: string; venue: string | null; publication_year: number | null };
type User = { name: string; email: string; role: "Admin" | "Researcher" };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const sessionResponse = await fetch("/api/auth");
    const session = await sessionResponse.json();
    setUser(session.user ?? null);
    if (!session.user) { setLoading(false); return; }
    const response = await fetch("/api/admin/papers");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load admin papers.");
    setPapers(result.papers);
    setLoading(false);
  }

  useEffect(() => { load().catch((error: unknown) => { setMessage(error instanceof Error ? error.message : "Could not load the admin page."); setLoading(false); }); }, []);

  async function addPaper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const yearValue = String(form.get("year") ?? "").trim();
    try {
      const response = await fetch("/api/admin/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"), abstract: form.get("abstract"), venue: form.get("venue"),
          doi: form.get("doi"), publicationYear: yearValue ? Number(yearValue) : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add paper.");
      formElement.reset();
      setMessage("Paper added to MySQL.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add paper.");
    } finally { setBusy(false); }
  }

  async function removePaper(paperId: number) {
    if (!window.confirm(`Delete paper ${paperId}?`)) return;
    setMessage("");
    const response = await fetch("/api/admin/papers", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId }),
    });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "Could not delete paper."); return; }
    setPapers((current) => current.filter((paper) => paper.paper_id !== paperId));
    setMessage("Paper deleted from MySQL.");
  }

  async function renamePaper(paper: Paper) {
    const title = window.prompt("New paper title", paper.title)?.trim();
    if (!title || title === paper.title) return;
    const response = await fetch("/api/admin/papers", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: paper.paper_id, title }),
    });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "Could not update paper."); return; }
    setPapers((current) => current.map((row) => row.paper_id === paper.paper_id ? { ...row, title } : row));
    setMessage("Paper title updated in MySQL.");
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function indexPapers() {
    if (!window.confirm("Generate embeddings for up to 500 MySQL papers and upsert them to MongoDB Atlas? The embedding provider may charge for usage.")) return;
    setIndexing(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/vector-index", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not index papers.");
      setMessage(`Indexed ${result.indexed} papers in Atlas using ${result.model}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not index papers.");
    } finally { setIndexing(false); }
  }

  return <main className="admin-page">
    <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">a</span><span>atlas<span className="brand-dot">.</span></span></Link><div><Link href="/">Research search</Link>{user && <span> &nbsp;·&nbsp; {user.name} ({user.role}) &nbsp;·&nbsp; <button onClick={signOut}>Sign out</button></span>}</div></header>
    {loading ? <p>Checking your account…</p> : !user ? <section className="admin-panel"><h1>Admin sign-in required</h1><p>Sign in with an administrator account to manage the MySQL paper library.</p><Link className="auth-submit admin-link" href="/login">Go to sign in ↗</Link></section> : user.role !== "Admin" ? <section className="admin-panel"><h1>Access denied</h1><p>Your account has the Researcher role. Only an Admin can manage paper records.</p><Link href="/">Return to discovery</Link></section> : <>
      <section className="admin-panel"><div className="eyebrow">DATABASE ADMINISTRATION</div><h1>Paper library</h1><p>Add or remove paper records in MySQL. This page and its API require the Admin role.</p><p>Generate embeddings for MySQL papers and sync them to the Atlas vector collection (maximum 500 papers per run).</p><button type="button" className="admin-index-button" onClick={indexPapers} disabled={indexing}>{indexing ? "Indexing papers…" : "Sync papers to Atlas Vector Search"}</button>
        <form className="admin-form" onSubmit={addPaper}>
          <label>Title<input name="title" required maxLength={1000} /></label>
          <label>Abstract<textarea name="abstract" required maxLength={20000} rows={4} /></label>
          <div className="admin-form-row"><label>Venue<input name="venue" maxLength={255} /></label><label>Year<input name="year" type="number" min="1000" max="2200" /></label><label>DOI<input name="doi" maxLength={255} /></label></div>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Add paper to MySQL"}</button>
        </form>
        {message && <p role="status" className="admin-message">{message}</p>}
      </section>
      <section className="admin-panel"><h2>Current records ({papers.length})</h2>{papers.map((paper) => <article className="admin-paper" key={paper.paper_id}><span><strong>#{paper.paper_id} · {paper.title}</strong><small>{paper.venue ?? "Venue not set"}{paper.publication_year ? ` · ${paper.publication_year}` : ""}</small></span><div><button type="button" onClick={() => renamePaper(paper)}>Edit title</button><button type="button" onClick={() => removePaper(paper.paper_id)}>Delete</button></div></article>)}</section>
    </>}
  </main>;
}
