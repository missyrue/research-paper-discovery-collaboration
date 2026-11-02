"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Paper = {
  id: string;
  title: string;
  authors: string;
  venue: string;
  abstract: string;
  tags: string[];
  year: number | null;
  match: string;
  color: string;
};
type CurrentUser = { name: string; email: string; role: "Admin" | "Researcher" };

const topics = ["All papers", "Machine learning", "Biology", "Computer vision", "Natural language"];

export default function Home() {
  const [query, setQuery] = useState("graph models for molecular discovery");
  const [submittedQuery, setSubmittedQuery] = useState("graph models for molecular discovery");
  const [activeTopic, setActiveTopic] = useState("All papers");
  const [saved, setSaved] = useState<string[]>([]);
  const [sort, setSort] = useState("Best match");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth").then((response) => response.json()).then((payload) => {
      if (active) setCurrentUser(payload.user ?? null);
    }).catch(() => { if (active) setCurrentUser(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // React Strict Mode runs effects through setup/cleanup once in development.
    // Ignore stale responses instead of aborting fetch, which can surface as an
    // uncaught AbortError in the Next.js dev overlay.
    let active = true;
    const params = new URLSearchParams({ q: submittedQuery, mode: searchMode, sort: sort === "Newest first" ? "newest" : "relevance" });
    if (activeTopic !== "All papers") params.set("topic", activeTopic);

    setLoading(true);
    setError("");
    fetch(`/api/papers?${params.toString()}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Paper search failed.");
        return payload as { papers: Paper[] };
      })
      .then((payload) => { if (active) setResults(payload.papers); })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load papers.");
        setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [submittedQuery, activeTopic, sort, searchMode]);

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    setCurrentUser(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Atlas home"><span className="brand-mark">a</span><span>atlas<span className="brand-dot">.</span></span></Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#discover"><span className="nav-icon">⌕</span> Discover</a>
          <a className="nav-item" href="#saved"><span className="nav-icon">♡</span> Saved papers <span className="nav-count">{saved.length || ""}</span></a>
          <a className="nav-item" href="#collections"><span className="nav-icon">▤</span> Collections</a>
          <a className="nav-item" href="#groups"><span className="nav-icon">◉</span> Research groups</a>
        </nav>
        <div className="sidebar-label topics-label">YOUR TOPICS <button className="plus-button" aria-label="Add topic">+</button></div>
        <div className="topic-list"><span>◦ &nbsp;Graph learning</span><span>◦ &nbsp;Computational biology</span><span>◦ &nbsp;Representation learning</span></div>
        <div className="sidebar-bottom">
          <div className="plan-card"><span className="plan-spark">✳</span><strong>Good research starts<br />with a good question.</strong><span>Save papers, build collections, and share your ideas.</span><a href="#about">Explore your workspace ↗</a></div>
          <div className="profile"><span className="avatar">{currentUser ? currentUser.name.slice(0, 2).toUpperCase() : "AC"}</span><span><strong>{currentUser?.name ?? "Guest researcher"}</strong><small>{currentUser ? currentUser.role : "Sign in to sync your library"}</small></span>{currentUser ? <button className="profile-menu profile-action" onClick={signOut}>Sign out</button> : <Link href="/login" className="profile-menu">Sign in</Link>}</div>
        </div>
      </aside>

      <section className="main-panel" id="discover">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Discover</strong></div><div className="top-actions"><span className="status-pill"><i /> MySQL connected</span>{currentUser?.role === "Admin" && <Link className="signin-link" href="/admin">Admin <span>↗</span></Link>}{!currentUser && <Link className="signin-link" href="/login">Sign in <span>↗</span></Link>}</div></header>
        <div className="content">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR RESEARCH, IN GOOD COMPANY</div>
          <h1>Find the ideas<br />that <em>move you forward.</em></h1>
          <p className="intro">Search across research by meaning, not just matching words.<br className="desktop-break" /> Discover connections you might have missed.</p>

          <form className="search-box" onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query); }} role="search">
            <span className="search-icon">⌕</span>
            <input aria-label="Search papers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe what you’re researching..." />
            <kbd>⌘ K</kbd>
            <button className="search-button" type="submit">Find papers <span>↗</span></button>
          </form>
          <div className="search-foot"><span>✳ &nbsp;Searching {searchMode === "semantic" ? "MongoDB Atlas vectors" : "your MySQL library"}</span><span>Try <button type="button" onClick={() => { const example = "transformers long documents"; setQuery(example); setSubmittedQuery(example); }}>“transformers long documents”</button></span></div>
          <div className="filter-row search-mode-row" aria-label="Search method">
            <span className="search-mode-label">Search with</span>
            <button type="button" onClick={() => setSearchMode("keyword")} className={`filter-chip ${searchMode === "keyword" ? "selected" : ""}`}>MySQL keywords</button>
            <button type="button" onClick={() => setSearchMode("semantic")} className={`filter-chip ${searchMode === "semantic" ? "selected" : ""}`}>Semantic vectors</button>
            {searchMode === "semantic" && !currentUser && <small>Sign in to use semantic search.</small>}
          </div>

          <div className="results-heading"><div><div className="section-kicker">A STARTING POINT</div><h2>Research worth a closer look <span className="result-count">{results.length.toString().padStart(2, "0")}</span></h2></div><label className="sort-control">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Best match</option><option>Newest first</option></select><span className="select-caret">⌄</span></label></div>

          <div className="filter-row" aria-label="Filter by topic">{topics.map((topic) => <button key={topic} onClick={() => setActiveTopic(topic)} className={`filter-chip ${activeTopic === topic ? "selected" : ""}`}>{topic}</button>)}</div>

          <div className="paper-list">{loading ? <p className="prototype-note">Loading papers from MySQL…</p> : error ? <p className="prototype-note">{error}</p> : results.length === 0 ? <p className="prototype-note">No papers matched. Try a shorter search or another topic.</p> : results.map((paper, index) => <article className="paper-card" key={paper.id}>
            <div className="paper-number">{paper.id}</div>
            <div className="paper-body"><div className="paper-meta"><span className={`paper-art ${paper.color}`}><span>{index === 0 ? "∿" : index === 1 ? "✳" : "◌"}</span></span><span>{paper.venue}</span><span className="match-label"><i />{paper.match}</span></div>
              <h3>{paper.title}</h3><p className="authors">{paper.authors}</p><p className="abstract">{paper.abstract}</p><div className="paper-footer"><div className="tag-list">{paper.tags.map((tag) => <span className="paper-tag" key={tag}>{tag}</span>)}</div><button className={`save-button ${saved.includes(paper.id) ? "saved" : ""}`} onClick={() => toggleSaved(paper.id)} aria-label={saved.includes(paper.id) ? "Remove saved paper" : "Save paper"}><span>{saved.includes(paper.id) ? "♥" : "♡"}</span> {saved.includes(paper.id) ? "Saved" : "Save paper"}</button></div>
            </div>
          </article>)}</div>
          <div className="prototype-note"><span>✳</span><p><strong>{searchMode === "semantic" ? "MongoDB Atlas Vector Search." : "MySQL paper library."}</strong> {searchMode === "semantic" ? "Vector similarity ranks papers; paper details are loaded from MySQL." : "Keyword matching and topic filters query the local relational database."} Saved-paper persistence and collaboration workflows remain future work.</p></div>
          <footer className="page-footer"><span>ATLAS <i>·</i> RESEARCH, CONNECTED</span><span>Made for curious minds <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>
    </main>
  );
}
