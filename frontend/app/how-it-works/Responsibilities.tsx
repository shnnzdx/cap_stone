"use client";
import { useEffect, useRef, useState } from "react";

const roles = [
  ["01", "AI", "Understand & draft", "Structures traveler input, drafts the itinerary, explains trade-offs, and suggests alternatives."],
  ["02", "Rules", "Validate & route", "Protects confirmed hard limits and routes each change by its impact and decision history."],
  ["03", "People", "Choose & confirm", "Every traveler controls their own needs. No organizer can decide or confirm for someone else."],
];

export default function Responsibilities() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: .2 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  return <section className={`responsibility-section shell ${visible ? "is-visible" : ""}`} ref={ref}>
    <p className="eyebrow">CLEAR RESPONSIBILITIES</p><h2>Three roles.<br />One reliable plan.</h2>
    <div className="responsibility-grid compact">{roles.map(([number, role, action, copy], index) => <article key={number} style={{ "--role-delay": `${index * 120}ms` } as React.CSSProperties}>
      <i className="voice-received" aria-hidden="true" /><span>{number}</span><h3>{role}</h3><strong>{action}</strong><p>{copy}</p>
    </article>)}</div>
  </section>;
}
