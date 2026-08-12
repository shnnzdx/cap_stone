"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const audiences = [
  {
    title: "Friends",
    text: "Different budgets and travel rhythms, held in one plan.",
    tone: "blue",
    icon: "friends",
  },
  {
    title: "Couples",
    text: "Shared choices without one person carrying the work.",
    tone: "sand",
    icon: "couples",
  },
  {
    title: "Families",
    text: "Hard limits, energy levels, and accessibility protected.",
    tone: "sage",
    icon: "families",
  },
] as const;

const quotes = [
  { label: "Traveler 01", meta: "Private budget", text: '"I need to stay under $1,500."' },
  { label: "Traveler 02", meta: "Preference", text: '"I want to see as much as possible."' },
  { label: "Traveler 03", meta: "Hard limit", text: '"I cannot walk for long periods."' },
  { label: "Traveler 04", meta: "Personal pace", text: '"I need a little time to recharge."' },
] as const;

function AudienceIcon({ type }: { type: "friends" | "couples" | "families" }) {
  if (type === "friends") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="10" cy="10" r="4" />
        <circle cx="22" cy="10" r="4" />
        <path d="M3.5 25c.7-5 3.1-7.5 6.5-7.5s5.8 2.5 6.5 7.5" />
        <path d="M15.5 25c.7-5 3.1-7.5 6.5-7.5s5.8 2.5 6.5 7.5" />
      </svg>
    );
  }

  if (type === "couples") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 26.5 5.8 16.6C1.2 12.2 4.1 5.3 10 5.3c2.6 0 4.7 1.3 6 3.4 1.3-2.1 3.4-3.4 6-3.4 5.9 0 8.8 6.9 4.2 11.3L16 26.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 14.5 16 5l11 9.5" />
      <path d="M8.5 13.5V27h15V13.5" />
      <path d="M13 27v-8h6v8" />
      <circle cx="16" cy="13" r="2.2" />
    </svg>
  );
}

function BubbleIcon({ index }: { index: number }) {
  const icons: ReactNode[] = [
    <svg key="wallet" viewBox="0 0 28 28" aria-hidden="true"><rect x="4" y="7" width="20" height="15" rx="3" /><path d="M4 10h16" /><path d="M18 13h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></svg>,
    <svg key="clock" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="9" /><path d="M14 9v6l4 2" /></svg>,
    <svg key="walk" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="6.5" r="2.5" /><path d="m13 10-2 6 4 2 2-5 3 3" /><path d="m11 16-3 7" /><path d="m15 18 4 5" /></svg>,
    <svg key="sun" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="5" /><path d="M14 3v4M14 21v4M3 14h4M21 14h4M6.2 6.2l2.8 2.8M19 19l2.8 2.8M21.8 6.2 19 9M9 19l-2.8 2.8" /></svg>,
  ];
  return icons[index];
}

export default function PeopleProblem() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sharedProgress, setSharedProgress] = useState(0);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let frame = 0;
    let resizeTimer = 0;
    const updateShared = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = scroll.getBoundingClientRect();
        const travel = Math.max(1, scroll.offsetHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, (90 - bounds.top) / travel));
        setSharedProgress(progress);
      });
    };

    updateShared();
    window.addEventListener("scroll", updateShared, { passive: true });
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateShared, 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", updateShared);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="section shell problem people-problem people-v2" id="why">
      <div className="people-v2__scroll" ref={scrollRef}>
        <div className="people-v2__stage">
          <p className="eyebrow people-v2__eyebrow">02 · SHARED NEEDS</p>
          <h2 className="people-v2__title">Every voice counts.</h2>

          <div className="people-v2__audiences">
            <svg className="people-v2__network" viewBox="0 0 1080 190" preserveAspectRatio="none" aria-hidden="true">
              <path d="M176 72 C202 72 218 78 238 90 M540 72 C540 84 540 94 540 104 M904 72 C878 72 862 78 842 90 M520 138 C528 142 534 145 540 146 C546 145 552 142 560 138" />
              <circle cx="176" cy="72" r="5" />
              <circle cx="540" cy="72" r="5" />
              <circle cx="904" cy="72" r="5" />
              <circle cx="540" cy="146" r="8" />
            </svg>
            {audiences.map((audience, index) => (
              <article
                key={audience.title}
                className={`people-v2__audience people-v2__audience--${audience.tone}`}
                style={{ "--delay": `${index * 110}ms` } as CSSProperties}
              >
                <div className="people-v2__audience-icon"><AudienceIcon type={audience.icon} /></div>
                <div className="people-v2__audience-copy">
                  <h3>{audience.title}</h3>
                  <p>{audience.text}</p>
                </div>
                <span className="people-v2__audience-rule" aria-hidden="true" />
              </article>
            ))}
          </div>

          <div className={`people-v2__lower ${sharedProgress > 0.01 ? "is-visible" : ""}`}>
            <article className="people-v2__problem-card">
              <p className="eyebrow">THE PROBLEM</p>
              <h3>Less chat.<br />Clear choices.</h3>
              <div className="people-v2__problem-line" aria-hidden="true" />
              <p className="people-v2__problem-support">More time traveling,<br />less time negotiating.</p>
              <svg className="people-v2__mountains" viewBox="0 0 420 118" aria-hidden="true">
                <path d="M0 108 48 90l30 7 66-61 38 38 33-28 33 32 31-19 50 49" />
                <path d="m76 96 68-60 18 28 20 10 30-24 24 27 18-11 29 27" />
                <path d="M250 108h158M300 108l10-25 10 25M330 108l12-33 12 33M362 108l9-24 10 24" />
              </svg>
            </article>

            <div className="people-v2__conversation">
              <svg className="people-v2__route" viewBox="0 0 620 360" preserveAspectRatio="none" aria-hidden="true">
                <path className="people-v2__route-guide" d="M68 68 C158 24 260 48 332 98 C398 144 487 126 546 178 C589 216 548 252 452 258 C358 264 296 226 208 248 C122 270 108 319 205 330 C326 344 432 300 566 334" />
                <path
                  className="people-v2__route-line"
                  pathLength="1"
                  d="M68 68 C158 24 260 48 332 98 C398 144 487 126 546 178 C589 216 548 252 452 258 C358 264 296 226 208 248 C122 270 108 319 205 330 C326 344 432 300 566 334"
                  style={{ strokeDashoffset: 1 - sharedProgress }}
                />
              </svg>

              <div className="people-v2__bubble-grid">
                {quotes.map((quote, index) => {
                  const reveal = Math.max(0, Math.min(1, (sharedProgress * quotes.length - index) * 1.25));
                  const bubbleStyle = {
                    "--bubble-opacity": `${0.14 + reveal * 0.86}`,
                    "--bubble-rise": `${(1 - reveal) * 34}px`,
                    "--bubble-scale": `${0.975 + reveal * 0.025}`,
                  } as CSSProperties;

                  return (
                    <article className={`people-v2__bubble people-v2__bubble--${index + 1}`} style={bubbleStyle} key={quote.label}>
                      <div className="people-v2__bubble-icon"><BubbleIcon index={index} /></div>
                      <div className="people-v2__bubble-copy">
                        <span>{quote.label}<i>/</i>{quote.meta}</span>
                        <p>{quote.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .product-page .people-problem.people-v2 {
          position: relative;
          width: 100%;
          max-width: none;
          min-height: 100svh;
          padding: clamp(64px, 7.5vh, 84px) 0 clamp(54px, 6.5vh, 78px);
          overflow: visible;
          background:
            radial-gradient(circle at 16% 8%, rgba(242, 239, 232, 0.58), rgba(242, 239, 232, 0) 34%),
            var(--people-section-surface, var(--surface-people));
          transform-origin: center top;
          z-index: 5;
          margin-top: -18svh;
          padding-top: calc(clamp(64px, 7.5vh, 84px) + 18svh);
          will-change: transform, opacity;
        }

        .product-page .people-v2__scroll {
          position: relative;
          width: min(1200px, calc(100% - 64px));
          margin-inline: auto;
          height: 185svh;
        }

        .product-page .people-v2__stage {
          position: sticky;
          z-index: 1;
          top: 112px;
          min-height: calc(100svh - 126px);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 18px;
        }

        .product-page .people-v2__eyebrow {
          margin: 0 0 4px;
        }

        .product-page .people-v2__title {
          margin: 0 0 8px;
          color: #102e50;
          font-family: var(--font-primary);
          font-size: clamp(54px, 5.3vw, 86px);
          font-weight: 400;
          line-height: 0.93;
          letter-spacing: -0.065em;
        }

        .product-page .people-v2__audiences {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(20px, 2.4vw, 30px);
          margin-top: 4px;
          padding: 20px 20px 54px;
          border: 1px solid var(--product-border-subtle);
          border-radius: var(--radius-panel);
          background:
            linear-gradient(rgba(83, 112, 136, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83, 112, 136, 0.035) 1px, transparent 1px),
            rgba(244, 243, 238, 0.58);
          background-size: 52px 52px, 52px 52px, auto;
          box-shadow: 0 12px 38px rgba(36, 58, 78, 0.045);
          perspective: 1200px;
        }

        .product-page .people-v2__network {
          position: absolute;
          z-index: 0;
          inset: 24px 3% 4px;
          width: 94%;
          height: calc(100% - 28px);
          overflow: visible;
          pointer-events: none;
        }

        .product-page .people-v2__network path {
          fill: none;
          stroke: var(--product-route);
          stroke-width: 1;
          stroke-dasharray: 3 9;
          vector-effect: non-scaling-stroke;
        }

        .product-page .people-v2__network circle {
          fill: var(--surface-people);
          stroke: var(--product-route-strong);
          stroke-width: 1;
          vector-effect: non-scaling-stroke;
        }

        .product-page .people-v2__audience {
          --ticket-bg: #f2f7fb;
          --ticket-accent: #4f88c7;
          position: relative;
          min-height: 140px;
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          align-items: center;
          gap: 15px;
          padding: 18px 38px 18px 18px;
          overflow: visible;
          color: #17314d;
          border: 1px solid rgba(92, 118, 143, 0.1);
          border-radius: var(--radius-card);
          background: color-mix(in srgb, var(--ticket-bg) 58%, transparent);
          box-shadow: 0 5px 16px rgba(44, 77, 107, 0.035);
          opacity: 0;
          transition: opacity 0.64s ease var(--delay), transform 0.78s cubic-bezier(.22, 1, .36, 1) var(--delay);
        }

        .product-page .people-v2__audience::before {
          content: "";
          position: absolute;
          z-index: 0;
          inset: 4px;
          border-radius: calc(var(--radius-card) - 3px);
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
          border: 1px solid rgba(104, 131, 158, 0.025);
          transform: rotate(0.18deg);
          pointer-events: none;
        }

        .product-page .people-v2__audience:nth-child(1) {
          transform: translateY(36px) rotate(-1.25deg) scale(0.985);
        }

        .product-page .people-v2__audience:nth-child(1)::before {
          background: rgba(240, 247, 252, 0.62);
          transform: rotate(0.45deg);
        }

        .product-page .people-v2__audience:nth-child(2) {
          transform: translateY(43px) rotate(0.72deg) scale(0.985);
        }

        .product-page .people-v2__audience:nth-child(2)::before {
          background: rgba(250, 246, 240, 0.66);
          transform: rotate(-0.35deg);
        }

        .product-page .people-v2__audience:nth-child(3) {
          transform: translateY(34px) rotate(-1deg) scale(0.985);
        }

        .product-page .people-v2__audience:nth-child(3)::before {
          background: rgba(243, 248, 241, 0.64);
          transform: rotate(0.4deg);
        }

        .product-page .people-v2__audience--sand {
          --ticket-bg: #f8f4ee;
          --ticket-accent: #b0705f;
        }

        .product-page .people-v2__audience--sage {
          --ticket-bg: #f1f6ef;
          --ticket-accent: #567f61;
        }

        .product-page .people-v2__audience > * {
          position: relative;
          z-index: 1;
        }

        .product-page .people-v2__audience-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: var(--radius-control);
          color: var(--ticket-accent);
          background: color-mix(in srgb, var(--ticket-accent) 10%, white 90%);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ticket-accent) 10%, transparent);
        }

        .product-page .people-v2__audience-icon svg {
          width: 24px;
          height: 24px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .product-page .people-v2__audience-copy {
          min-width: 0;
        }

        .product-page .people-v2__audience-copy h3 {
          margin: 0 0 8px;
          color: #17314d;
          font-family: var(--font-primary);
          font-size: clamp(23px, 2vw, 30px);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.045em;
          text-transform: uppercase;
        }

        .product-page .people-v2__audience-copy p {
          max-width: 275px;
          margin: 0;
          color: #60758b;
          font-size: 13px;
          line-height: 1.5;
        }

        .product-page .people-v2__audience-rule {
          position: absolute;
          top: 22px;
          right: 28px;
          bottom: 22px;
          width: 0;
          border-left: 1px dashed rgba(83, 116, 146, 0.13);
          pointer-events: none;
        }

        .product-page .people-v2__lower {
          min-height: 326px;
          display: grid;
          grid-template-columns: minmax(420px, 0.84fr) minmax(0, 1.16fr);
          align-items: center;
          gap: clamp(30px, 4.2vw, 58px);
          margin-top: 16px;
        }

        .product-page .people-v2__problem-card {
          position: relative;
          min-height: 292px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 30px 32px 38px;
          overflow: hidden;
          border: 1px solid rgba(105, 125, 142, 0.085);
          border-radius: var(--radius-panel);
          background: linear-gradient(145deg, rgba(250, 252, 252, 0.86), rgba(247, 248, 246, 0.8));
          box-shadow: var(--product-shadow-panel);
          transform: rotate(-1.05deg);
          transform-origin: center;
          opacity: 0.35;
          translate: 0 22px;
          transition: opacity 0.55s ease, translate 0.7s cubic-bezier(.22, 1, .36, 1);
        }

        .product-page .people-v2__lower.is-visible .people-v2__problem-card {
          opacity: 1;
          translate: 0 0;
        }

        .product-page .people-v2__problem-card .eyebrow {
          margin-bottom: 20px;
        }

        .product-page .people-v2__problem-card h3 {
          margin: 0;
          color: #102e50;
          font-family: var(--font-primary);
          font-size: clamp(42px, 3.7vw, 56px);
          font-weight: 400;
          line-height: 0.94;
          letter-spacing: -0.055em;
          white-space: nowrap;
        }

        .product-page .people-v2__problem-line {
          width: 42px;
          height: 1px;
          margin: 22px 0 13px;
          background: #6d9dce;
        }

        .product-page .people-v2__problem-support {
          margin: 0;
          color: #60758b;
          font-size: 13px;
          line-height: 1.55;
        }

        .product-page .people-v2__mountains {
          position: absolute;
          right: 12px;
          bottom: 8px;
          width: 66%;
          height: auto;
          opacity: 0.1;
          fill: none;
          stroke: #6a9ac9;
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .product-page .people-v2__conversation {
          position: relative;
          width: min(100%, 650px);
          min-height: 354px;
          justify-self: end;
        }

        .product-page .people-v2__route {
          position: absolute;
          inset: 4% -1% 1%;
          z-index: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
        }

        .product-page .people-v2__route-guide,
        .product-page .people-v2__route-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .product-page .people-v2__route-guide {
          stroke: rgba(95, 145, 199, 0.08);
          stroke-width: 1.35;
          stroke-dasharray: 3 12;
        }

        .product-page .people-v2__route-line {
          stroke: rgba(95, 145, 199, 0.3);
          stroke-width: 1.45;
          stroke-dasharray: 1;
          transition: stroke-dashoffset 0.08s linear;
        }

        .product-page .people-v2__bubble-grid {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: block;
          pointer-events: none;
        }

        .product-page .people-v2__bubble {
          position: relative;
          min-height: 82px;
          display: grid;
          grid-template-columns: 42px 1fr;
          align-items: center;
          gap: 12px;
          padding: 11px 14px 10px;
          border: 1px solid rgba(82, 111, 137, 0.11);
          border-radius: var(--radius-card);
          background: rgba(246, 246, 242, 0.82);
          box-shadow: 0 6px 18px rgba(45, 70, 92, 0.045);
          backdrop-filter: blur(7px);
          opacity: var(--bubble-opacity);
          transition: box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.18s ease;
          pointer-events: auto;
        }

        .product-page .people-v2__bubble:hover {
          border-color: rgba(73, 126, 182, 0.28);
          box-shadow: 0 8px 22px rgba(45, 70, 92, 0.065);
        }

        .product-page .people-v2__bubble--1 {
          position: absolute;
          left: 1%;
          top: 2%;
          width: 48%;
          transform: translate(-10px, calc(-4px + var(--bubble-rise))) rotate(-1.15deg) scale(var(--bubble-scale));
        }

        .product-page .people-v2__bubble--2 {
          position: absolute;
          right: -1%;
          top: 23%;
          width: 49%;
          transform: translate(10px, calc(0px + var(--bubble-rise))) rotate(1.05deg) scale(var(--bubble-scale));
        }

        .product-page .people-v2__bubble--3 {
          position: absolute;
          left: 4%;
          top: 52%;
          width: 47%;
          transform: translate(-14px, calc(0px + var(--bubble-rise))) rotate(-1deg) scale(var(--bubble-scale));
        }

        .product-page .people-v2__bubble--4 {
          position: absolute;
          right: -1%;
          top: 72%;
          width: 48%;
          transform: translate(12px, calc(2px + var(--bubble-rise))) rotate(1.15deg) scale(var(--bubble-scale));
        }

        .product-page .people-v2__bubble-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #557ca5;
          background: rgba(86, 136, 190, 0.09);
          box-shadow: inset 0 0 0 1px rgba(74, 121, 170, 0.08);
        }

        .product-page .people-v2__bubble-icon svg {
          width: 23px;
          height: 23px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.55;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .product-page .people-v2__bubble--2 .people-v2__bubble-icon {
          color: #5f8466;
          background: rgba(95, 132, 102, 0.08);
        }

        .product-page .people-v2__bubble--3 .people-v2__bubble-icon {
          color: #a46c50;
          background: rgba(164, 108, 80, 0.08);
        }

        .product-page .people-v2__bubble-copy {
          min-width: 0;
        }

        .product-page .people-v2__bubble-copy span {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;
          gap: 6px;
          color: #55799f;
          font-family: var(--font-label);
          font-size: 8.6px;
          line-height: 1;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .product-page .people-v2__bubble-copy span i {
          font-style: normal;
          opacity: 0.5;
        }

        .product-page .people-v2__bubble-copy p {
          margin: 7px 0 0;
          color: #17314d;
          font-family: var(--font-primary);
          font-size: clamp(14px, 1.08vw, 17px);
          font-weight: 400;
          line-height: 1.27;
          letter-spacing: -0.02em;
        }

        .product-page .people-problem.people-v2::before,
        .product-page .people-problem.people-v2::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 0;
          opacity: 0.032;
          background-repeat: no-repeat;
          background-size: contain;
        }

        .product-page .people-problem.people-v2::before {
          width: 34%;
          height: 42%;
          right: 1.5%;
          top: 11%;
          background-image:
            radial-gradient(ellipse at 35% 40%, transparent 58%, rgba(56, 91, 123, 0.75) 59%, transparent 60%),
            radial-gradient(ellipse at 55% 55%, transparent 66%, rgba(56, 91, 123, 0.65) 67%, transparent 68%),
            radial-gradient(ellipse at 72% 38%, transparent 74%, rgba(56, 91, 123, 0.5) 75%, transparent 76%);
          transform: rotate(-7deg);
        }

        .product-page .people-problem.people-v2::after {
          width: 28%;
          height: 30%;
          left: -2%;
          bottom: 2%;
          background-image:
            radial-gradient(ellipse at 45% 48%, transparent 61%, rgba(56, 91, 123, 0.6) 62%, transparent 63%),
            radial-gradient(ellipse at 62% 54%, transparent 70%, rgba(56, 91, 123, 0.48) 71%, transparent 72%);
          transform: rotate(8deg);
        }

        @media (max-width: 1100px), (max-height: 760px) {
          .product-page .people-problem.people-v2 {
            margin-top: -10svh;
            padding-top: calc(44px + 10svh);
          }

          .product-page .people-v2__scroll {
            height: auto;
          }

          .product-page .people-v2__stage {
            position: relative;
            top: auto;
            min-height: 0;
          }

          .product-page .people-v2__title {
            font-size: clamp(50px, 5.8vw, 76px);
          }

          .product-page .people-v2__lower {
            grid-template-columns: minmax(400px, 0.84fr) minmax(0, 1.16fr);
          }

          .product-page .people-v2__problem-card {
            min-height: 268px;
            padding: 28px 30px 34px;
          }

          .product-page .people-v2__problem-card h3 {
            font-size: clamp(40px, 4.2vw, 52px);
            white-space: nowrap;
          }

          .product-page .people-v2__conversation {
            min-height: 328px;
          }
        }

        @media (min-width: 821px) and (max-height: 900px) {
          .product-page .people-problem.people-v2 {
            padding-top: 64px;
            padding-bottom: 32px;
          }

          .product-page .people-v2__stage {
            top: 102px;
            min-height: calc(100svh - 116px);
            gap: 16px;
          }

          .product-page .people-v2__title {
            font-size: clamp(52px, 5.1vw, 80px);
            margin-bottom: 6px;
          }

          .product-page .people-v2__audience {
            min-height: 134px;
          }

          .product-page .people-v2__lower {
            min-height: 300px;
            margin-top: 14px;
          }

          .product-page .people-v2__problem-card {
            min-height: 272px;
          }

          .product-page .people-v2__conversation {
            min-height: 336px;
          }
        }

        @media (max-width: 820px) {
          .product-page .people-problem.people-v2 {
            width: 100%;
          }

          .product-page .people-v2__scroll {
            width: min(100% - 40px, 720px);
          }

          .product-page .people-v2__audiences {
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 16px 16px 22px;
          }

          .product-page .people-v2__network {
            display: none;
          }

          .product-page .people-v2__audience,
          .product-page .people-v2__audience:nth-child(n),
          .product-page .people-v2__audiences.is-visible .people-v2__audience:nth-child(n) {
            transform: none;
          }

          .product-page .people-v2__lower {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .product-page .people-v2__problem-card {
            min-height: 310px;
            transform: rotate(-0.45deg);
          }

          .product-page .people-v2__conversation {
            justify-self: stretch;
            width: 100%;
          }
        }

        @media (max-width: 620px) {
          .product-page .people-problem.people-v2 {
            width: 100%;
            margin-top: -7svh;
            padding-top: calc(34px + 7svh);
          }

          .product-page .people-v2__scroll {
            width: min(100% - 24px, 560px);
          }

          .product-page .people-v2__title {
            font-size: clamp(48px, 14vw, 62px);
          }

          .product-page .people-v2__audience {
            grid-template-columns: 42px 1fr;
            min-height: 136px;
            padding: 20px 36px 20px 20px;
            gap: 14px;
          }

          .product-page .people-v2__audience-icon {width: 40px;height: 40px}

          .product-page .people-v2__audience-copy h3 {
            font-size: 23px;
          }

          .product-page .people-v2__problem-card {
            min-height: 280px;
            padding: 34px 28px 46px;
          }

          .product-page .people-v2__problem-card h3 {
            font-size: clamp(42px, 12vw, 56px);
            white-space: normal;
          }

          .product-page .people-v2__conversation {
            min-height: 0;
          }

          .product-page .people-v2__bubble-grid {
            position: relative;
            inset: auto;
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            padding-inline: 0;
          }

          .product-page .people-v2__bubble--1,
          .product-page .people-v2__bubble--2,
          .product-page .people-v2__bubble--3,
          .product-page .people-v2__bubble--4 {
            position: relative;
            inset: auto;
            width: 94%;
            margin: 0 !important;
            transform: translateY(var(--bubble-rise)) scale(var(--bubble-scale));
          }

          .product-page .people-v2__bubble--1,
          .product-page .people-v2__bubble--3 {
            justify-self: start;
          }

          .product-page .people-v2__bubble--2,
          .product-page .people-v2__bubble--4 {
            justify-self: end;
          }

          .product-page .people-v2__route {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .product-page .people-problem.people-v2 {
            transform: none !important;
            clip-path: inset(0 round var(--radius-section) var(--radius-section) 0 0) !important;
            box-shadow: none !important;
          }

          .product-page .people-v2__audience,
          .product-page .people-v2__problem-card,
          .product-page .people-v2__bubble {
            opacity: 1 !important;
            transform: none !important;
            translate: 0 0 !important;
            transition: none !important;
          }

          .product-page .people-v2__route-line {
            stroke-dashoffset: 0 !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
