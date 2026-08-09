"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Create",
    text: "Add a destination and date range, then bring everyone in with one link.",
    note: "Everyone enters the plan with equal decision weight.",
    action: "Start a trip",
    icon: "+",
  },
  {
    number: "02",
    title: "Share",
    text: "Each traveler adds preferences, hard limits, and private needs in their own space.",
    note: "Private input can shape the plan without being shown to the group.",
    action: "See private input",
    icon: "*",
  },
  {
    number: "03",
    title: "Build",
    text: "AI drafts a complete itinerary; fixed rules check dates, budgets, and must-haves.",
    note: "A plan only goes live after every confirmed hard limit passes.",
    action: "See plan checks",
    icon: "^",
  },
  {
    number: "04",
    title: "Decide",
    text: "CADENSY checks hard limits and decision history before the plan moves.",
    note: "Open changes apply directly; contested choices open a round; hard-limit changes require confirmation.",
    action: "Explore decisions",
    icon: "o",
  },
  {
    number: "05",
    title: "Adapt",
    text: "The Current Plan updates without rebuilding what already works.",
    note: "Every decision stays traceable, and hard limits stay protected.",
    action: "See the living plan",
    icon: "v",
  },
] as const;

const featureSignals = [
  ["Destination + dates", "Open shared space", "One invitation link"],
  ["Private preferences", "Structure hard limits", "Protected group needs"],
  ["Confirmed inputs", "Draft + validate", "One viable plan"],
  ["Change request", "Route by impact", "Notice, round, or confirm"],
  ["Resolved changes", "Preserve what works", "Current Plan stays ready"],
] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export default function FeatureStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const holdRatio = 0.18;
  const activeSpan = 1 / (features.length + holdRatio);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const frameNode = frameRef.current;
    const windowNode = windowRef.current;
    const topbar = topbarRef.current;
    if (!section || !stage || !frameNode || !windowNode || !topbar) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let progressFrame = 0;
    let displayed = 0;
    let measureFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let lastProgress = 0;
    let stepStartProgress = 0.22;
    const featureCount = features.length;
    const backdropMetrics = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      round: 32,
    };

    const applyBackdropMetrics = () => {
      const stageBounds = stage.getBoundingClientRect();
      const windowBounds = windowNode.getBoundingClientRect();
      const surround = Math.max(Math.min(window.innerWidth * 0.024, 28), 18);
      const topSurround = Math.max(Math.min(window.innerHeight * 0.028, 32), 22);

      backdropMetrics.top = Math.max(windowBounds.top - stageBounds.top - topSurround, 0);
      backdropMetrics.right = Math.max(stageBounds.right - windowBounds.right - surround, 0);
      backdropMetrics.bottom = Math.max(stageBounds.bottom - windowBounds.bottom - surround, 0);
      backdropMetrics.left = Math.max(windowBounds.left - stageBounds.left - surround, 0);
      backdropMetrics.round = Math.max(windowBounds.height * 0.075, 24);
      applyProgressStyles(lastProgress);
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => {
        applyBackdropMetrics();
        measureFrame = 0;
      });
    };

    const applyProgressStyles = (progress: number) => {
      const introProgress = reduceMotion ? 1 : clamp(progress / Math.max(stepStartProgress, 0.0001));
      const introEase = easeOutCubic(introProgress);
      const clipScale = 1 - introEase;
      section.style.setProperty("--story-progress", progress.toFixed(4));
      section.style.setProperty("--intro-progress", introProgress.toFixed(4));
      section.style.setProperty("--intro-ease", introEase.toFixed(4));
      section.style.setProperty("--step-start-progress", stepStartProgress.toFixed(4));
      section.style.setProperty("--stage-topbar-shift", `${(1 - introEase) * 54}px`);
      section.style.setProperty("--stage-frame-shift", `${(1 - introEase) * 92}px`);
      section.style.setProperty("--navy-clip-top", `${backdropMetrics.top * clipScale}px`);
      section.style.setProperty("--navy-clip-right", `${backdropMetrics.right * clipScale}px`);
      section.style.setProperty("--navy-clip-bottom", `${backdropMetrics.bottom * clipScale}px`);
      section.style.setProperty("--navy-clip-left", `${backdropMetrics.left * clipScale}px`);
      section.style.setProperty("--navy-clip-round", `${backdropMetrics.round * clipScale}px`);
    };

    const update = () => {
      cancelAnimationFrame(progressFrame);
      progressFrame = requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect();
        const travel = Math.max(1, bounds.height - window.innerHeight);
        stepStartProgress = clamp(window.innerHeight / (travel + window.innerHeight));
        const nextProgress = clamp((window.innerHeight - bounds.top) / (travel + window.innerHeight));
        lastProgress = nextProgress;
        applyProgressStyles(nextProgress);

        const stepProgress = clamp((nextProgress - stepStartProgress) / Math.max(1 - stepStartProgress, 0.0001));
        const next = stepProgress <= 0.001
          ? -1
          : Math.min(featureCount - 1, Math.floor(stepProgress / activeSpan));
        if (next !== displayed) {
          displayed = next;
          setActiveIndex(next);
        }
      });
    };

    update();
    scheduleMeasure();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => scheduleMeasure());
      resizeObserver.observe(stage);
      resizeObserver.observe(frameNode);
      resizeObserver.observe(windowNode);
      resizeObserver.observe(topbar);
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("load", scheduleMeasure);
    document.fonts?.ready.then(() => scheduleMeasure()).catch(() => {});

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("load", scheduleMeasure);
      resizeObserver?.disconnect();
      cancelAnimationFrame(progressFrame);
      cancelAnimationFrame(measureFrame);
    };
  }, []);

  const goToStep = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = window.scrollY + section.getBoundingClientRect().top;
    const travel = section.offsetHeight - window.innerHeight;
    const stepStartProgress = clamp(window.innerHeight / Math.max(travel + window.innerHeight, 1));
    const overallProgress = stepStartProgress + ((index * activeSpan) * (1 - stepStartProgress));
    window.scrollTo({
      top: top - window.innerHeight + ((travel + window.innerHeight) * overallProgress),
      behavior: "smooth",
    });
  };

  return (
    <section className="feature-story" id="process" ref={sectionRef} aria-label="How CADENSY works">
      <div className="story-stage" ref={stageRef}>
        <div className="process-navy-backdrop" aria-hidden="true" />
        <div className="story-topbar" ref={topbarRef}>
          <span className="story-mini-brand"><i>T</i> CADENSY</span>
          <span>03 / PROCESS</span>
        </div>
        <div className="story-frame" ref={frameRef}>
          <div className="story-window" ref={windowRef}>
            <aside className="story-intro">
              <p className="story-label">HOW IT WORKS</p>
              <h2>Five steps.<br />One living plan.</h2>
              <p>Private needs stay protected. Every change follows a clear path.</p>
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
                              <span>{["INPUT", "CADENSY", "GROUP RESULT"][signalIndex]}</span>
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
      </div>
    </section>
  );
}
