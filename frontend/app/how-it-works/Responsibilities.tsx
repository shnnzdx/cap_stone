"use client";
import { useEffect, useRef, useState } from "react";

const roles = [
  ["01", "AI", "Understand & generate", "Organizes vague input, asks up to three essential questions, and creates targeted revisions."],
  ["02", "Backend", "Validate the plan", "Enforces confirmed must-haves, maximum budgets, and available dates before a version can advance."],
  ["03", "People", "Review & decide", "Members control their conditions. The organizer verifies facts and moves the process forward."],
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
    <p className="eyebrow">CLEAR RESPONSIBILITIES</p><h2>Three roles. One reliable plan.</h2>
    <div className="responsibility-list">{roles.map(([number, role, action, copy], index) => <article key={number} style={{ "--role-delay": `${index * 120}ms` } as React.CSSProperties}>
      <span>{number}</span><h3>{role}</h3><strong>{action}</strong><p>{copy}</p><i aria-hidden="true" />
    </article>)}</div>
  </section>;
}
