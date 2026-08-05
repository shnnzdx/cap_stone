"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const audiences = [
  ["Friends", "Different budgets, interests, and travel rhythms."],
  ["Couples", "Shared decisions without one person carrying the plan."],
  ["Families", "Accessibility, energy levels, and personal budget shares."],
];

const quotes = [
  "“I need to stay under $1,500.”",
  "“I want to see as much as possible.”",
  "“I can’t walk for long periods.”",
];

export default function PeopleProblem() {
  const audienceRef = useRef<HTMLDivElement>(null);
  const sharedRef = useRef<HTMLDivElement>(null);
  const [audienceVisible, setAudienceVisible] = useState(false);
  const [sharedProgress, setSharedProgress] = useState(0);

  useEffect(() => {
    const audience = audienceRef.current;
    const shared = sharedRef.current;
    if (!audience || !shared) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (entry.target === audience) setAudienceVisible(true);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18 });

    observer.observe(audience);
    let frame = 0;
    const updateShared = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = shared.getBoundingClientRect();
        const travel = Math.max(1, shared.offsetHeight - window.innerHeight);
        setSharedProgress(Math.max(0, Math.min(1, (88 - bounds.top) / travel)));
      });
    };
    updateShared();
    window.addEventListener("scroll", updateShared, { passive: true });
    window.addEventListener("resize", updateShared);
    return () => { observer.disconnect(); window.removeEventListener("scroll", updateShared); window.removeEventListener("resize", updateShared); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section className="section shell problem people-problem" id="why">
      <p className="eyebrow">02 · PEOPLE</p>
      <div className="audience-heading">
        <h2>Every voice matters.</h2>
        <p>Different travelers bring different limits, priorities, and rhythms.</p>
      </div>
      <div className={`audience-strip ${audienceVisible ? "is-visible" : ""}`} ref={audienceRef}>
        {audiences.map(([title, text], index) => (
          <article className="audience-card" key={title} style={{ "--quote-delay": `${index * 120}ms`, "--quote-x": index === 0 ? "-14px" : index === 2 ? "14px" : "0px" } as CSSProperties}>
            <i className="voice-received" aria-hidden="true" /><span>0{index + 1}</span><div className="audience-content-mask"><div><h3>{title}</h3><p>{text}</p></div></div>
          </article>
        ))}
      </div>

      <div className="shared-problem-scroll" ref={sharedRef}>
        <div className={`shared-problem ${sharedProgress > .01 ? "is-visible" : ""}`}>
          <div className="problem-subsection">
            <p className="eyebrow">THE PROBLEM</p>
            <h3><span>Less chat.</span><span>Clear decisions.</span></h3>
            <p>Group chats collect opinions. TripSync turns them into constraints, decisions, and one accepted plan.</p>
          </div>
          <div className="quote-grid">
            {quotes.map((quote, index) => {
              const reveal = Math.max(0, Math.min(1, (sharedProgress * 3 - index) * 1.25));
              return <article className={`quote-card tone-${index + 1}`} style={{ opacity: .24 + reveal * .76, transform: `translateY(${(1 - reveal) * 68}px) scale(${.985 + reveal * .015})`, zIndex: 8 - index } as CSSProperties} key={quote}>
                <i className="voice-received" aria-hidden="true" /><span>Traveler 0{index + 1}</span><div className="quote-mask"><p>{quote}</p></div>
              </article>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
