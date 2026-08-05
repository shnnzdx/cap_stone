"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const links = [["Product", "/"], ["How It Works", "/how-it-works"], ["Privacy", "/privacy"], ["FAQ", "/faq"]];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);
  return <header className="site-header">
    <nav className="shell nav" aria-label="Main navigation">
      <Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link>
      <div className="nav-links">{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
      <div className="nav-actions"><Link href="/login">Log in</Link><Link className="button dark compact" href="/signup?next=/trips/new">Create a trip</Link></div>
      <button className="menu-toggle" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><i /><i /><i /></button>
    </nav>
    <div className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="mobile-menu-bar"><Link className="brand" href="/" onClick={() => setOpen(false)}><span className="brand-mark">T</span>TripSync</Link><button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label="Mobile navigation">{links.map(([label, href], index) => <Link href={href} key={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}<i>↗</i></Link>)}</nav>
      <div className="mobile-menu-actions"><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link className="button dark" href="/signup?next=/trips/new" onClick={() => setOpen(false)}>Create a trip</Link></div>
    </div>
  </header>;
}
