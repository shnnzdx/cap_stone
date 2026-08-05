"use client";

import Header from "../Header";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState(false);
  const [nextPath, setNextPath] = useState("/trip");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/")) setNextPath(requested);
  }, []);

  if (created) {
    return (
      <main className="signup-page">
        <Header />
        <section className="signup-page-shell shell">
          <div className="signup-copy-block">
            <p className="eyebrow">CREATE ACCOUNT</p>
            <h1>Ready when<br />you are.</h1>
            <p className="signup-lede">TripSync turns scattered preferences into one shared trip plan. Create your account to keep the group moving from input to confirmed decisions.</p>
            <div className="signup-benefits" aria-label="Account benefits">
              <article>
                <span>01</span>
                <strong>Private input</strong>
                <p>Keep personal limits and preferences organized without turning the group chat into a checklist.</p>
              </article>
              <article>
                <span>02</span>
                <strong>Explainable plan</strong>
                <p>Review a proposed trip with clear reasons, constraints, and revision history.</p>
              </article>
              <article>
                <span>03</span>
                <strong>Ready to launch</strong>
                <p>Move directly into your trip workspace once the account is created.</p>
              </article>
            </div>
          </div>

          <section className="signup-card signup-success">
            <p className="login-kicker">You&apos;re ready</p>
            <h1>Account created.</h1>
            <p>Your planning space is ready. Continue to login and start a trip with your group.</p>
            <Link className="login-submit" href={`/login?next=${encodeURIComponent(nextPath)}`}>Continue to login <span>→</span></Link>
          </section>
        </section>
        <footer className="site-footer signup-footer">
          <div className="shell footer-grid">
            <div><Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link><p>Plan a trip everyone can agree on.</p></div>
            <div><strong>Product</strong><Link href="/#product-overview">Overview</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div>
            <div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/signup?next=/trip">Create a trip</Link></div>
          </div>
          <div className="shell copyright">© 2026 TripSync</div>
        </footer>
      </main>
    );
  }

  return (
    <main className="signup-page">
      <Header />
      <section className="signup-page-shell shell">
        <div className="signup-copy-block">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h1>Ready when<br />you are.</h1>
          <p className="signup-lede">TripSync turns scattered preferences into one shared trip plan. Create your account to keep the group moving from input to confirmed decisions.</p>
          <div className="signup-benefits" aria-label="Account benefits">
            <article>
              <span>01</span>
              <strong>Private input</strong>
              <p>Keep personal limits and preferences organized without turning the group chat into a checklist.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Explainable plan</strong>
              <p>Review a proposed trip with clear reasons, constraints, and revision history.</p>
            </article>
            <article>
              <span>03</span>
              <strong>Ready to launch</strong>
              <p>Move directly into your trip workspace once the account is created.</p>
            </article>
          </div>
          <p className="signup-copy">Already have an account? <Link href="/login">Log in</Link></p>
        </div>

        <section className="signup-card">
          <div className="login-heading">
            <p className="login-kicker">Create your account</p>
            <h2>Start planning together.</h2>
            <p>It takes less than a minute. You can change your profile later.</p>
          </div>
          <form className="login-form" onSubmit={(event) => { event.preventDefault(); setCreated(true); }}>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" autoComplete="name" placeholder="Your name" required />
            <label htmlFor="signup-email">Email address</label>
            <input id="signup-email" name="email" autoComplete="email" type="email" placeholder="you@example.com" required />
            <label htmlFor="signup-password">Password</label>
            <div className="password-field">
              <input id="signup-password" name="password" autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" minLength={8} required />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" name="confirmPassword" autoComplete="new-password" type="password" placeholder="Re-enter your password" minLength={8} required />
            <label className="signup-consent"><input type="checkbox" required /> <span>I agree to the <Link href="/privacy">Privacy Policy</Link> and understand how TripSync uses planning data.</span></label>
            <button className="login-submit" type="submit">Create account <span>→</span></button>
          </form>
        </section>
      </section>
      <footer className="site-footer signup-footer">
        <div className="shell footer-grid">
          <div><Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link><p>Plan a trip everyone can agree on.</p></div>
          <div><strong>Product</strong><Link href="/#product-overview">Overview</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div>
          <div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/signup?next=/trip">Create a trip</Link></div>
        </div>
        <div className="shell copyright">© 2026 TripSync</div>
      </footer>
    </main>
  );
}
