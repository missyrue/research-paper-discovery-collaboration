"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const papers = [
  {
    id: "01",
    title: "Molecular Property Prediction with Graph Neural Networks",
    authors: "J. Gilmer, S. S. Schoenholz, P. F. Riley, O. Vinyals, G. E. Dahl",
    venue: "Proceedings of ICML · 2017",
    abstract: "A message-passing framework for learning molecular representations and predicting quantum chemical properties directly from molecular graphs.",
    tags: ["Machine learning", "Chemistry"],
    year: 2017,
    match: "Strong semantic match",
    color: "lavender",
  },
  {
    id: "02",
    title: "Attention Is All You Need",
    authors: "A. Vaswani, N. Shazeer, N. Parmar, and others",
    venue: "Advances in Neural Information Processing Systems · 2017",
    abstract: "The Transformer architecture relies on attention mechanisms to model sequence relationships, removing recurrence from machine translation systems.",
    tags: ["Deep learning", "Language"],
    year: 2017,
    match: "Related methods",
    color: "peach",
  },
  {
    id: "03",
    title: "Learning Transferable Visual Models From Natural Language Supervision",
    authors: "A. Radford, J. W. Kim, C. Hallacy, and others",
    venue: "Proceedings of ICML · 2021",
    abstract: "Contrastive language-image pre-training learns visual concepts from natural language supervision and supports zero-shot transfer to downstream datasets.",
    tags: ["Representation learning", "Vision"],
    year: 2021,
    match: "Related methods",
    color: "mint",
  },
];

const topics = ["All papers", "Machine learning", "Biology", "Computer vision", "Natural language"];

export default function Home() {
  const [query, setQuery] = useState("graph models for molecular discovery");
  const [activeTopic, setActiveTopic] = useState("All papers");
  const [saved, setSaved] = useState<string[]>([]);
  const [sort, setSort] = useState("Best match");
  const results = useMemo(() => {
    let filtered = papers.filter((paper) => activeTopic === "All papers" || paper.tags.includes(activeTopic));
    if (sort === "Newest first") filtered = [...filtered].sort((a, b) => b.year - a.year);
    return filtered;
  }, [activeTopic, sort]);

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
          <Link href="/login" className="profile"><span className="avatar">AC</span><span><strong>Guest researcher</strong><small>Sign in to sync your library</small></span><span className="profile-menu">···</span></Link>
        </div>
      </aside>

      <section className="main-panel" id="discover">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Discover</strong></div><div className="top-actions"><span className="status-pill"><i /> Prototype</span><Link className="signin-link" href="/login">Sign in <span>↗</span></Link></div></header>
        <div className="content">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR RESEARCH, IN GOOD COMPANY</div>
          <h1>Find the ideas<br />that <em>move you forward.</em></h1>
          <p className="intro">Search across research by meaning, not just matching words.<br className="desktop-break" /> Discover connections you might have missed.</p>

          <form className="search-box" onSubmit={(event) => event.preventDefault()} role="search">
            <span className="search-icon">⌕</span>
            <input aria-label="Search papers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe what you’re researching..." />
            <kbd>⌘ K</kbd>
            <button className="search-button" type="submit">Find papers <span>↗</span></button>
          </form>
          <div className="search-foot"><span>✳ &nbsp;Searching by meaning</span><span>Try <button onClick={() => setQuery("how do transformers understand long documents?")}>“how do transformers understand long documents?”</button></span></div>

          <div className="results-heading"><div><div className="section-kicker">A STARTING POINT</div><h2>Research worth a closer look <span className="result-count">{results.length.toString().padStart(2, "0")}</span></h2></div><label className="sort-control">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Best match</option><option>Newest first</option></select><span className="select-caret">⌄</span></label></div>

          <div className="filter-row" aria-label="Filter by topic">{topics.map((topic) => <button key={topic} onClick={() => setActiveTopic(topic)} className={`filter-chip ${activeTopic === topic ? "selected" : ""}`}>{topic}</button>)}</div>

          <div className="paper-list">{results.map((paper, index) => <article className="paper-card" key={paper.id}>
            <div className="paper-number">{paper.id}</div>
            <div className="paper-body"><div className="paper-meta"><span className={`paper-art ${paper.color}`}><span>{index === 0 ? "∿" : index === 1 ? "✳" : "◌"}</span></span><span>{paper.venue}</span><span className="match-label"><i />{paper.match}</span></div>
              <h3>{paper.title}</h3><p className="authors">{paper.authors}</p><p className="abstract">{paper.abstract}</p><div className="paper-footer"><div className="tag-list">{paper.tags.map((tag) => <span className="paper-tag" key={tag}>{tag}</span>)}</div><button className={`save-button ${saved.includes(paper.id) ? "saved" : ""}`} onClick={() => toggleSaved(paper.id)} aria-label={saved.includes(paper.id) ? "Remove saved paper" : "Save paper"}><span>{saved.includes(paper.id) ? "♥" : "♡"}</span> {saved.includes(paper.id) ? "Saved" : "Save paper"}</button></div>
            </div>
          </article>)}</div>
          <div className="prototype-note"><span>✳</span><p><strong>Just getting started.</strong> These sample papers show how Atlas will surface related work. Connect your database and embedding model to search your own research library.</p></div>
          <footer className="page-footer"><span>ATLAS <i>·</i> RESEARCH, CONNECTED</span><span>Made for curious minds <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>
    </main>
  );
}
