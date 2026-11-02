import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/"><span className="brand-mark">a</span><span>atlas<span className="brand-dot">.</span></span></Link>
      <section className="auth-card">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR RESEARCH, IN GOOD COMPANY</div>
        <h1>Welcome<br /><em>back.</em></h1>
        <p className="auth-intro">Sign in to pick up where your curiosity left off.</p>
        <form className="auth-form" action="#">
          <label htmlFor="email">University email</label>
          <input id="email" name="email" type="email" placeholder="you@university.edu" autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" />
          <button type="button" className="auth-submit">Sign in <span>↗</span></button>
        </form>
        <p className="auth-notice">Sign in will be enabled when the project authentication service is connected.</p>
        <p className="auth-switch">New to Atlas? <span>Account creation is coming soon.</span></p>
      </section>
      <p className="auth-caption">A quieter place to follow a question.</p>
    </main>
  );
}
