"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Paper = { paper_id: number; title: string; venue: string | null; publication_year: number | null };
type User = { name: string; email: string; role: "Admin" | "Researcher" };
type EvaluationSection = { title: string; sql: string; rows: Record<string, string | number | null>[] };

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}). Check the Next.js terminal for the route error, then restart the dev server if needed.`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`The server returned a non-JSON response (HTTP ${response.status}). Check the Next.js terminal for the route error.`);
  }
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<Record<string, EvaluationSection> | null>(null);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const sessionResponse = await fetch("/api/auth");
    const session = await readApiResponse<{ user?: User | null }>(sessionResponse);
    setUser(session.user ?? null);
    if (!session.user) { setLoading(false); return; }
    const response = await fetch("/api/admin/papers");
    const result = await readApiResponse<{ papers: Paper[]; error?: string }>(response);
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
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Could not add paper.");
      formElement.reset();
      setMessage("Paper added to MySQL. Run Atlas sync to include it in semantic search.");
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
    const result = await readApiResponse<{ error?: string; vectorRemoved?: boolean }>(response);
    if (!response.ok) { setMessage(result.error ?? "Could not delete paper."); return; }
    setPapers((current) => current.filter((paper) => paper.paper_id !== paperId));
    setMessage(result.vectorRemoved ? "Paper deleted from MySQL and Atlas." : "Paper deleted from MySQL, but Atlas cleanup failed. Retry Atlas sync after checking the connection.");
  }

  async function renamePaper(paper: Paper) {
    const title = window.prompt("New paper title", paper.title)?.trim();
    if (!title || title === paper.title) return;
    try {
      const response = await fetch("/api/admin/papers", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: paper.paper_id, title }),
      });
      const result = await readApiResponse<{ error?: string; vectorInvalidated?: boolean }>(response);
      if (!response.ok) { setMessage(result.error ?? "Could not update paper."); return; }
      setPapers((current) => current.map((row) => row.paper_id === paper.paper_id ? { ...row, title } : row));
      setMessage(result.vectorInvalidated ? "Paper updated in MySQL. Run Atlas sync to recreate its embedding." : "Paper updated in MySQL, but its old Atlas vector could not be cleared. Check Atlas, then sync again.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update paper.");
    }
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function indexPapers() {
    if (!window.confirm("Generate embeddings locally with Ollama for the MySQL papers and upsert them to MongoDB Atlas? This uses your computer and does not call a paid embedding API.")) return;
    setIndexing(true);
    setMessage("");
    try {
      let afterPaperId = "0";
      let indexed = 0;
      let skipped = 0;
      let model = "";
      while (true) {
        const response = await fetch("/api/admin/vector-index", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterPaperId }),
        });
        const result = await readApiResponse<{
          error?: string;
          indexed: number;
          skipped: number;
          model: string;
          done: boolean;
          nextAfterPaperId: string | null;
        }>(response);
        if (!response.ok) throw new Error(result.error ?? "Could not index papers.");
        indexed += result.indexed;
        skipped += result.skipped;
        model = result.model;
        setMessage(`Processed through paper ${result.nextAfterPaperId ?? "the end"}; embedded ${indexed}, skipped ${skipped} unchanged.`);
        if (result.done) break;
        if (!result.nextAfterPaperId) throw new Error("The vector index API did not return a continuation paper ID.");
        afterPaperId = result.nextAfterPaperId;
      }
      setMessage(`Atlas sync complete: ${indexed} embedded or updated, ${skipped} unchanged, using ${model}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not index papers.");
    } finally { setIndexing(false); }
  }

  async function runEvaluation() {
    setEvaluating(true);
    setEvaluationMessage("");
    try {
      const response = await fetch("/api/admin/evaluation", { method: "POST" });
      const result = await readApiResponse<{ error?: string; results?: Record<string, EvaluationSection>; writesRolledBack?: boolean }>(response);
      if (!response.ok || !result.results) throw new Error(result.error ?? "Could not run the MySQL evaluation demo.");
      setEvaluation(result.results);
      setEvaluationMessage(result.writesRolledBack ? "Evaluation complete. The UPDATE and DELETE demos were rolled back; no paper changes were kept." : "Evaluation complete.");
    } catch (error) {
      setEvaluationMessage(error instanceof Error ? error.message : "Could not run the MySQL evaluation demo.");
    } finally { setEvaluating(false); }
  }

  function renderEvaluationTable(rows: EvaluationSection["rows"]) {
    if (!rows.length) return <p className="evaluation-empty">No matching rows in the current MySQL data.</p>;
    const columns = Object.keys(rows[0]);
    return <div className="evaluation-table-wrap"><table className="evaluation-table"><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
  }

  return <main className="admin-page">
    <header className="admin-header"><Link className="brand" href="/" aria-label="Paperloom home"><span className="brand-mark">p</span><span>paperloom<span className="brand-dot">.</span></span></Link><div><Link href="/">Research search</Link>{user && <span> &nbsp;·&nbsp; {user.name} ({user.role}) &nbsp;·&nbsp; <button onClick={signOut}>Sign out</button></span>}</div></header>
    {loading ? <p>Checking your account…</p> : !user ? <section className="admin-panel"><h1>Admin sign-in required</h1><p>Sign in with an administrator account to manage the MySQL paper library.</p><Link className="auth-submit admin-link" href="/login">Go to sign in ↗</Link></section> : user.role !== "Admin" ? <section className="admin-panel"><h1>Access denied</h1><p>Your account has the Researcher role. Only an Admin can manage paper records.</p><Link href="/">Return to discovery</Link></section> : <>
      <section className="admin-panel"><div className="eyebrow">DATABASE ADMINISTRATION</div><h1>Paper library</h1><p>Add or remove paper records in MySQL. This page and its API require the Admin role.</p><p>Generate local embeddings with Ollama and sync papers to the Atlas vector collection (maximum 500 papers per run).</p><button type="button" className="admin-index-button" onClick={indexPapers} disabled={indexing}>{indexing ? "Indexing papers…" : "Sync papers to Atlas Vector Search"}</button>
        <form className="admin-form" onSubmit={addPaper}>
          <label>Title<input name="title" required maxLength={1000} /></label>
          <label>Abstract<textarea name="abstract" required maxLength={20000} rows={4} /></label>
          <div className="admin-form-row"><label>Venue<input name="venue" maxLength={255} /></label><label>Year<input name="year" type="number" min="1000" max="2200" /></label><label>DOI<input name="doi" maxLength={255} /></label></div>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Add paper to MySQL"}</button>
        </form>
        {message && <p role="status" className="admin-message">{message}</p>}
      </section>
      <section className="admin-panel evaluation-panel"><div className="eyebrow">DBMS EVALUATION</div><h2>Run SQL concept demo</h2><p>Execute live MySQL JOIN, GROUP BY, correlated/nested subquery, view, UPDATE, DELETE, and audit-trigger examples against the current paper data.</p><p>The UPDATE and DELETE examples run in transactions and are rolled back, so your paper records stay unchanged.</p><button type="button" className="admin-index-button" onClick={runEvaluation} disabled={evaluating}>{evaluating ? "Running SQL examples…" : "Run database evaluation"}</button>
        {evaluationMessage && <p role="status" className="admin-message">{evaluationMessage}</p>}
        {evaluation && <div className="evaluation-results">{Object.entries(evaluation).map(([key, section]) => <article className="evaluation-result" key={key}><h3>{section.title}</h3><pre><code>{section.sql}</code></pre>{renderEvaluationTable(section.rows)}</article>)}</div>}
      </section>
      <section className="admin-panel"><h2>Current records ({papers.length})</h2>{papers.map((paper) => <article className="admin-paper" key={paper.paper_id}><span><strong>#{paper.paper_id} · {paper.title}</strong><small>{paper.venue ?? "Venue not set"}{paper.publication_year ? ` · ${paper.publication_year}` : ""}</small></span><div><button type="button" onClick={() => renamePaper(paper)}>Edit title</button><button type="button" onClick={() => removePaper(paper.paper_id)}>Delete</button></div></article>)}</section>
    </>}
  </main>;
}
