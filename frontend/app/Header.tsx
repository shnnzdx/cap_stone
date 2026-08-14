"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import SessionAwareLink from "./SessionAwareLink";

const navLinks = [
  { href: "/", label: "Product" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/faq", label: "FAQ" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  return (
    <header className="site-header">
      <nav className="shell nav" aria-label="Main navigation">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <BrandLogo />
        </Link>

        <div className="nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </div>

        <div className="nav-actions desktop-actions">
          <SessionAwareLink fallbackHref="/login" fallbackLabel="Log in" signedInLabel="Open trip" />
          <SessionAwareLink className="button dark compact" fallbackHref="/signup?next=/trips/new" fallbackLabel="Create a trip" signedInLabel="Open trip" />
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="nav-toggle-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="nav-toggle-label">{open ? "Close" : "Menu"}</span>
        </button>
      </nav>

      <div className={`mobile-nav-overlay ${open ? "is-open" : ""}`} id="mobile-nav-panel" aria-hidden={!open}>
        <div className="mobile-nav-card">
          <div className="mobile-nav-top">
            <Link className="brand" href="/" onClick={() => setOpen(false)}>
              <BrandLogo />
            </Link>
            <button type="button" className="mobile-nav-close" onClick={() => setOpen(false)} aria-label="Close menu">
              X
            </button>
          </div>

          <div className="mobile-nav-links">
            {navLinks.map((link, index) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                <span className="mobile-nav-index">0{index + 1}</span>
                <span>{link.label}</span>
                <span className="mobile-nav-arrow">-&gt;</span>
              </Link>
            ))}
          </div>

          <div className="mobile-nav-actions">
            <SessionAwareLink fallbackHref="/login" fallbackLabel="Log in" signedInLabel="Open trip" onClick={() => setOpen(false)} />
            <SessionAwareLink className="button dark" fallbackHref="/signup?next=/trips/new" fallbackLabel="Create a trip" signedInLabel="Open trip" onClick={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  );
}
