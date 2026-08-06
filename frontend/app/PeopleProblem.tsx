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
  "“I need a little time to recharge.”",
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
    let resizeTimer = 0;
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
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateShared, 120);
    };
    window.addEventListener("resize", onResize);
    return () => { observer.disconnect(); window.removeEventListener("scroll", updateShared); window.removeEventListener("resize", onResize); window.clearTimeout(resizeTimer); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section className="section shell problem people-problem" id="why">
      <div className="people-scroll" ref={sharedRef}>
        <div className="people-stage">
          <p className="eyebrow">02 · PEOPLE</p>
          <div className="audience-heading">
            <h2>Every voice matters.</h2>
          </div>
          <div className={`audience-strip ${audienceVisible ? "is-visible" : ""}`} ref={audienceRef}>
            {audiences.map(([title, text], index) => (
              <article className="audience-card" key={title} style={{ "--quote-delay": `${index * 120}ms`, "--quote-x": index === 0 ? "-14px" : index === 2 ? "14px" : "0px" } as CSSProperties}>
                <i className="voice-received" aria-hidden="true" /><span>0{index + 1}</span><div className="audience-content-mask"><div><h3>{title}</h3><p>{text}</p></div></div>
              </article>
            ))}
          </div>

          <div className={`shared-problem ${sharedProgress > .01 ? "is-visible" : ""}`}>
            <div className="problem-subsection">
              <p className="eyebrow">THE PROBLEM</p>
              <h3>Less chat.<br />Clear decisions.</h3>
            </div>
            <div className="quote-grid">
              {quotes.map((quote, index) => {
                const reveal = Math.max(0, Math.min(1, (sharedProgress * quotes.length - index) * 1.22));
                return <article className={`quote-card tone-${index + 1}`} style={{ opacity: .18 + reveal * .82, transform: `translateY(${(1 - reveal) * 42}px) scale(${.97 + reveal * .03})`, zIndex: 8 - index } as CSSProperties} key={quote}>
                  <i className="voice-received" aria-hidden="true" /><span>Traveler 0{index + 1}</span><div className="quote-mask"><p>{quote}</p></div>
                </article>;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
