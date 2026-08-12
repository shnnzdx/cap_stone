"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";

const links = [["Product", "/"], ["How It Works", "/how-it-works"], ["Privacy", "/privacy"], ["FAQ", "/faq"]];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [isOnDark, setIsOnDark] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;

    const desktopMedia = window.matchMedia("(min-width: 901px)");
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const activeSections = new Set<Element>();

    const disconnectObserver = () => {
      observer?.disconnect();
      observer = null;
      activeSections.clear();
    };

    const applyDarkState = () => setIsOnDark(activeSections.size > 0);

    const connectObserver = () => {
      disconnectObserver();
      if (!desktopMedia.matches) {
        setIsOnDark(false);
        return;
      }

      const darkSections = Array.from(document.querySelectorAll<HTMLElement>("[data-header-theme='dark']"));
      if (!darkSections.length) {
        setIsOnDark(false);
        return;
      }

      const headerHeight = Math.max(header.getBoundingClientRect().height, 1);
      const viewportHeight = Math.max(window.innerHeight, headerHeight + 1);
      const stripPercent = Math.min((headerHeight / viewportHeight) * 100, 32);
      const rootMargin = `0px 0px -${Math.max(0, 100 - stripPercent).toFixed(3)}% 0px`;

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activeSections.add(entry.target);
          else activeSections.delete(entry.target);
        });
        applyDarkState();
      }, { root: null, rootMargin, threshold: 0 });

      darkSections.forEach((section) => observer?.observe(section));
      applyDarkState();
    };

    const handleViewportModeChange = () => {
      if (!desktopMedia.matches) {
        disconnectObserver();
        setIsOnDark(false);
        return;
      }
      connectObserver();
    };

    connectObserver();
    resizeObserver = new ResizeObserver(() => connectObserver());
    resizeObserver.observe(header);
    window.addEventListener("resize", connectObserver);
    desktopMedia.addEventListener("change", handleViewportModeChange);

    return () => {
      window.removeEventListener("resize", connectObserver);
      desktopMedia.removeEventListener("change", handleViewportModeChange);
      resizeObserver?.disconnect();
      disconnectObserver();
    };
  }, []);

  return <header className={`site-header ${isOnDark ? "is-on-dark" : ""}`.trim()}>
    <nav className="shell nav" aria-label="Main navigation">
      <Link className="brand" href="/"><BrandLogo tone={isOnDark ? "light" : "default"} /></Link>
      <div className="nav-links">{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
      <div className="nav-actions"><Link href="/login">Log in</Link><Link className="button dark compact" href="/signup?next=/trips/new">Create a trip</Link></div>
      <button className="menu-toggle" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><i /><i /><i /></button>
    </nav>
    <div className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="mobile-menu-bar"><Link className="brand" href="/" onClick={() => setOpen(false)}><BrandLogo /></Link><button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label="Mobile navigation">{links.map(([label, href], index) => <Link href={href} key={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}<i>↗</i></Link>)}</nav>
      <div className="mobile-menu-actions"><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link className="button dark" href="/signup?next=/trips/new" onClick={() => setOpen(false)}>Create a trip</Link></div>
    </div>
  </header>;
}
