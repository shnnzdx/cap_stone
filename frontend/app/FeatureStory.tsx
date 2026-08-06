"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Create",
    text: "Add a destination and date range, then invite everyone with one link.",
    note: "Create opens a shared planning space. It does not make decisions for the group.",
    action: "Start a trip",
    icon: "+",
  },
  {
    number: "02",
    title: "Share",
    text: "Each traveler adds priorities, hard limits, and private concerns in their own space.",
    note: "People can be honest without turning every preference into a group debate.",
    action: "See private input",
    icon: "*",
  },
  {
    number: "03",
    title: "Generate",
    text: "AI proposes one plan; the backend checks dates, must-haves, and maximum budgets.",
    note: "Generation and deterministic validation remain separate responsibilities.",
    action: "View validation",
    icon: "^",
  },
  {
    number: "04",
    title: "Review",
    text: "The organizer verifies facts. Members accept, suggest, or request a change on a specific section.",
    note: "Feedback stays attached to the part of the plan it affects - no real-time chat required.",
    action: "Explore review",
    icon: "o",
  },
  {
    number: "05",
    title: "Publish",
    text: "AI makes targeted revisions; the backend validates the full plan before a new version is published.",
    note: "Members keep control of their conditions. The organizer cannot bypass validation.",
    action: "See versioning",
    icon: "v",
  },
];

const featureSignals = [
  ["Destination + dates", "Open shared space", "One invitation link"],
  ["Private preferences", "Organize constraints", "Clear group needs"],
  ["Group priorities", "Generate + validate", "One viable draft"],
  ["Section feedback", "Target revisions", "Accepted decisions"],
  ["Validated version", "Lock final choices", "Publish shared plan"],
];

export default function FeatureStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const holdRatio = 0.18;
  const activeSpan = 1 / (features.length + holdRatio);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let frame = 0;
    let displayed = 0;
    const featureCount = features.length;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect();
        const travel = Math.max(1, bounds.height - window.innerHeight);
        const nextProgress = Math.max(0, Math.min(1, -bounds.top / travel));
        const next = Math.min(featureCount - 1, Math.floor(nextProgress / activeSpan));
        if (next !== displayed) {
          displayed = next;
          setActiveIndex(next);
        }
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goToStep = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = window.scrollY + section.getBoundingClientRect().top;
    const travel = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * (index * activeSpan), behavior: "smooth" });
  };

  return (
    <section className="feature-story" id="process" ref={sectionRef} aria-label="How TripSync works">
      <div className="story-frame">
        <div className="story-topbar">
          <span className="story-mini-brand"><i>T</i> TripSync</span>
          <span>03 / PROCESS</span>
        </div>
        <div className="story-window">
          <aside className="story-intro">
            <p className="story-label">HOW IT WORKS</p>
            <h2>Five steps.<br />One decision.</h2>
            <p>Each stage keeps private input, revision, and final agreement clear.</p>
            <nav className="story-nav" aria-label="Choose a process step">
              {features.map((feature, index) => (
                <button
                  type="button"
                  key={feature.number}
                  className={index === activeIndex ? "is-active" : ""}
                  aria-current={index === activeIndex ? "step" : undefined}
                  aria-label={`Go to step ${feature.number}: ${feature.title}`}
                  onClick={() => goToStep(index)}
                >{feature.number}</button>
              ))}
            </nav>
          </aside>

          <div className="process-viewport">
            <div className="stacked-features">
              {features.map((feature, index) => (
                <article
                  className={[
                    "stacked-feature",
                    index < activeIndex ? "is-completed" : "",
                    index === activeIndex ? "is-active" : "",
                    index > activeIndex ? "is-future" : "",
                  ].filter(Boolean).join(" ")}
                  key={feature.number}
                >
                  <button type="button" className="stacked-heading" onClick={() => goToStep(index)} aria-expanded={index === activeIndex}>
                    <span className="stacked-icon">{feature.icon}</span>
                    <span className="stacked-title"><small>{feature.number}</small>{feature.title}</span>
                    <i>-&gt;</i>
                  </button>
                  <div className="stacked-detail">
                    <div className="stacked-detail-inner">
                      <div className="stacked-copy">
                        <p>{feature.text}</p>
                        <small>{feature.note}</small>
                      </div>
                      <div className="stacked-signal" aria-label={`${feature.title} information flow`}>
                        {featureSignals[index].map((signal, signalIndex) => (
                          <div key={signal}>
                            <span>{["INPUT", "TRIPSYNC", "GROUP RESULT"][signalIndex]}</span>
                            <strong>{signal}</strong>
                          </div>
                        ))}
                      </div>
                      <Link href={index === 0 ? "/signup?next=/trips/new" : "/how-it-works"}>{feature.action}<span>-&gt;</span></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
