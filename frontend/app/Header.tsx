"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
          <span className="brand-mark">T</span>
          TripSync
        </Link>

        <div className="nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </div>

        <div className="nav-actions desktop-actions">
          <Link href="/login">Log in</Link>
          <Link className="button dark compact" href="/signup?next=/trips/new">Create a trip</Link>
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
              <span className="brand-mark">T</span>
              TripSync
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
            <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
            <Link className="button dark" href="/signup?next=/trips/new" onClick={() => setOpen(false)}>Create a trip</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
