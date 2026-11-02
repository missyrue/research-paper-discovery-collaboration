"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

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
type PaperCollection = { id: string; name: string; paperIds: string[] };

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error(`The server returned an empty response (HTTP ${response.status}). Check the Next.js terminal.`);
  try { return JSON.parse(body) as T; }
  catch { throw new Error(`The server returned a non-JSON response (HTTP ${response.status}). Check the Next.js terminal.`); }
}

const topics = ["All papers", "Machine learning", "Biology", "Computer vision", "Natural language"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState("All papers");
  const [saved, setSaved] = useState<Paper[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [collections, setCollections] = useState<PaperCollection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionSelections, setCollectionSelections] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("Best match");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [results, setResults] = useState<Paper[]>([]);
  const [expandedPaperIds, setExpandedPaperIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("atlas:saved-papers");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setSaved(parsed as Paper[]);
      }
    } catch {
      // Keep the page usable if browser storage is unavailable or malformed.
    } finally {
      setSavedLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!savedLoaded) return;
    try {
      window.localStorage.setItem("atlas:saved-papers", JSON.stringify(saved));
    } catch {
      // Saving still works for this page session if browser storage is full or disabled.
    }
  }, [saved, savedLoaded]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("atlas:collections");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setCollections(parsed as PaperCollection[]);
      }
    } catch {
      // Keep the page usable if browser storage is unavailable or malformed.
    } finally {
      setCollectionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!collectionsLoaded) return;
    try {
      window.localStorage.setItem("atlas:collections", JSON.stringify(collections));
    } catch {
      // Collections remain usable for this page session if browser storage is unavailable.
    }
  }, [collections, collectionsLoaded]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth").then((response) => readApiResponse<{ user?: CurrentUser | null }>(response)).then((payload) => {
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
        const payload = await readApiResponse<{ papers?: Paper[]; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error ?? "Paper search failed.");
        if (!payload.papers) throw new Error("The server response did not include paper results.");
        return { papers: payload.papers };
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

  function toggleDescription(paperId: string) {
    setExpandedPaperIds((current) => {
      const next = new Set(current);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }

  function toggleSaved(paper: Paper) {
    const removing = saved.some((item) => item.id === paper.id);
    setSaved((current) => current.some((item) => item.id === paper.id)
      ? current.filter((item) => item.id !== paper.id)
      : [...current, paper]);
    if (removing) {
      setCollections((current) => current.map((collection) => ({
        ...collection,
        paperIds: collection.paperIds.filter((id) => id !== paper.id),
      })));
    }
  }

  function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (!name || collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase())) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCollections((current) => [...current, { id, name, paperIds: [] }]);
    setNewCollectionName("");
  }

  function addPaperToCollection(collectionId: string) {
    const paperId = collectionSelections[collectionId];
    if (!paperId) return;
    setCollections((current) => current.map((collection) => collection.id === collectionId && !collection.paperIds.includes(paperId)
      ? { ...collection, paperIds: [...collection.paperIds, paperId] }
      : collection));
  }

  function removePaperFromCollection(collectionId: string, paperId: string) {
    setCollections((current) => current.map((collection) => collection.id === collectionId
      ? { ...collection, paperIds: collection.paperIds.filter((id) => id !== paperId) }
      : collection));
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    setCurrentUser(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Paperloom home"><span className="brand-mark">p</span><span>paperloom<span className="brand-dot">.</span></span></Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#discover"><span className="nav-icon">⌕</span> Discover</a>
          <a className="nav-item" href="#saved"><span className="nav-icon">♡</span> Saved papers <span className="nav-count">{saved.length || ""}</span></a>
          <a className="nav-item" href="#collections"><span className="nav-icon">▤</span> Collections <span className="nav-count">{collections.length || ""}</span></a>
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
              <h3>{paper.title}</h3><p className="authors">{paper.authors}</p><p className="abstract-preview">{paper.abstract.split(/\s+/).slice(0, 24).join(" ")}{paper.abstract.split(/\s+/).length > 24 ? "…" : ""}</p><button type="button" className="description-toggle" aria-expanded={expandedPaperIds.has(paper.id)} onClick={() => toggleDescription(paper.id)}>{expandedPaperIds.has(paper.id) ? "Hide full description" : "Read full description"}</button>{expandedPaperIds.has(paper.id) && <p className="abstract">{paper.abstract}</p>}<div className="paper-footer"><div className="tag-list">{paper.tags.map((tag) => <span className="paper-tag" key={tag}>{tag}</span>)}</div><button className={`save-button ${saved.some((item) => item.id === paper.id) ? "saved" : ""}`} onClick={() => toggleSaved(paper)} aria-label={saved.some((item) => item.id === paper.id) ? "Remove saved paper" : "Save paper"}><span>{saved.some((item) => item.id === paper.id) ? "♥" : "♡"}</span> {saved.some((item) => item.id === paper.id) ? "Saved" : "Save paper"}</button></div>
            </div>
          </article>)}</div>
          <section className="saved-section" id="saved" aria-labelledby="saved-heading">
            <div className="results-heading"><div><div className="section-kicker">YOUR LIBRARY</div><h2 id="saved-heading">Saved papers <span className="result-count">{saved.length.toString().padStart(2, "0")}</span></h2></div></div>
            {saved.length === 0 ? <p className="prototype-note">No saved papers yet. Choose “Save paper” on any result to add it here.</p> : <div className="paper-list">{saved.map((paper) => <article className="paper-card" key={paper.id}>
              <div className="paper-number">{paper.id}</div>
              <div className="paper-body"><div className="paper-meta"><span className={`paper-art ${paper.color}`}><span>♡</span></span><span>{paper.venue}</span><span className="match-label"><i />Saved in this browser</span></div>
                <h3>{paper.title}</h3><p className="authors">{paper.authors}</p><p className="abstract-preview">{paper.abstract.split(/\s+/).slice(0, 24).join(" ")}{paper.abstract.split(/\s+/).length > 24 ? "…" : ""}</p><button type="button" className="description-toggle" aria-expanded={expandedPaperIds.has(paper.id)} onClick={() => toggleDescription(paper.id)}>{expandedPaperIds.has(paper.id) ? "Hide full description" : "Read full description"}</button>{expandedPaperIds.has(paper.id) && <p className="abstract">{paper.abstract}</p>}<div className="paper-footer"><div className="tag-list">{paper.tags.map((tag) => <span className="paper-tag" key={tag}>{tag}</span>)}</div><button className="save-button saved" onClick={() => toggleSaved(paper)} aria-label="Remove saved paper"><span>♥</span> Remove</button></div>
              </div>
            </article>)}</div>}
          </section>
          <section className="collections-section" id="collections" aria-labelledby="collections-heading">
            <div className="results-heading"><div><div className="section-kicker">ORGANIZE YOUR READING</div><h2 id="collections-heading">Collections <span className="result-count">{collections.length.toString().padStart(2, "0")}</span></h2></div></div>
            <form className="collection-create" onSubmit={createCollection}>
              <input aria-label="New collection name" value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} maxLength={80} placeholder="Name a collection, e.g. Graph learning" />
              <button className="search-button" type="submit" disabled={!newCollectionName.trim()}>Create collection</button>
            </form>
            {collections.length === 0 ? <p className="prototype-note">No collections yet. Create one above to group saved papers by topic or project.</p> : <div className="collection-list">{collections.map((collection) => {
              const collectionPapers = collection.paperIds.map((id) => saved.find((paper) => paper.id === id)).filter((paper): paper is Paper => Boolean(paper));
              const selectedPaper = collectionSelections[collection.id] ?? "";
              return <article className="collection-card" key={collection.id}>
                <div className="collection-heading"><div><div className="section-kicker">{collectionPapers.length} {collectionPapers.length === 1 ? "PAPER" : "PAPERS"}</div><h3>{collection.name}</h3></div><button className="save-button" type="button" onClick={() => setCollections((current) => current.filter((item) => item.id !== collection.id))}>Delete collection</button></div>
                {saved.length === 0 ? <p className="collection-empty">Save papers from Discover first, then add them to this collection.</p> : <form className="collection-add" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); addPaperToCollection(collection.id); }}>
                  <select aria-label={`Choose a saved paper for ${collection.name}`} value={selectedPaper} onChange={(event) => setCollectionSelections((current) => ({ ...current, [collection.id]: event.target.value }))}>
                    <option value="">Choose a saved paper</option>
                    {saved.map((paper) => <option key={paper.id} value={paper.id} disabled={collection.paperIds.includes(paper.id)}>{paper.title}{collection.paperIds.includes(paper.id) ? " (added)" : ""}</option>)}
                  </select>
                  <button className="filter-chip selected" type="submit" disabled={!selectedPaper || collection.paperIds.includes(selectedPaper)}>Add paper</button>
                </form>}
                {collectionPapers.length > 0 && <div className="collection-paper-list">{collectionPapers.map((paper) => <div className="collection-paper" key={paper.id}><div><strong>{paper.title}</strong><span>{paper.authors}</span></div><button className="save-button" type="button" onClick={() => removePaperFromCollection(collection.id, paper.id)}>Remove</button></div>)}</div>}
              </article>;
            })}</div>}
          </section>
          <div className="prototype-note"><span>✳</span><p><strong>{searchMode === "semantic" ? "MongoDB Atlas Vector Search." : "MySQL paper library."}</strong> {searchMode === "semantic" ? "Vector similarity ranks papers; paper details are loaded from MySQL." : "Keyword matching and topic filters query the local relational database."} Saved papers and collections are stored in this browser.</p></div>
          <footer className="page-footer"><span>PAPERLOOM <i>·</i> RESEARCH, CONNECTED</span><span>Made for curious minds <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>
    </main>
  );
}
