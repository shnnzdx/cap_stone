"use client";

import { useEffect, useRef, useState } from "react";

const principles = [
  { key: "validate", word: "Validate", symbol: "*", tone: "validate", range: [0.16, 0.4] as const },
  { key: "protect", word: "Protect", symbol: "[]", tone: "protect", range: [0.34, 0.58] as const },
  { key: "explain", word: "Explain", symbol: "~", tone: "explain", range: [0.52, 0.76] as const },
  { key: "confirm", word: "Confirm", symbol: "v", tone: "confirm", range: [0.7, 0.9] as const },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const getReveal = (progress: number, start: number, end: number) => clamp((progress - start) / Math.max(end - start, 0.0001));
const easeOutQuad = (value: number) => 1 - Math.pow(1 - value, 2);
const headingOffset = 108;
const itemOffsets = [202, 156, 118, 84] as const;
const transitionOffset = 64;

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(1);
      return;
    }

    let progressFrame = 0;
    const updateProgress = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      const next = clamp(-rect.top / distance);
      if (progressFrame) cancelAnimationFrame(progressFrame);
      progressFrame = requestAnimationFrame(() => {
        setProgress(next);
        progressFrame = 0;
      });
    };

    updateProgress();

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      cancelAnimationFrame(progressFrame);
    };
  }, []);

  const getMotionStyle = (start: number, end: number, offset: number) => {
    const reveal = easeOutQuad(getReveal(progress, start, end));
    return {
      opacity: reveal,
      transform: `translate3d(0, ${offset * (1 - reveal)}px, 0)`,
    };
  };

  const lineReveal = easeOutQuad(getReveal(progress, 0.93, 1));

  return (
    <div className="principle-scroll" ref={sectionRef} aria-label="TripSync core product principles">
      <div className="principle-stage">
        <div className="principle-map" aria-hidden="true" style={getMotionStyle(0.0, 0.26, headingOffset)}>
          <div className="principle-map-land" />
          <svg className="principle-route" viewBox="0 0 1200 660" preserveAspectRatio="xMidYMid meet">
            <path className="principle-route-guide" d="M154 174 C252 150 304 206 390 230 S548 252 630 324 S768 412 862 420 S992 456 1052 510" />
            <path className="principle-route-line" pathLength="1" d="M154 174 C252 150 304 206 390 230 S548 252 630 324 S768 412 862 420 S992 456 1052 510" />
            <g className="principle-route-points">
              {[
                [154, 174], [232, 166], [310, 206], [390, 230], [474, 242], [554, 274], [630, 324],
                [694, 378], [770, 412], [862, 420], [940, 442], [1004, 474], [1052, 510],
              ].map(([x, y], index) => (
                <circle className="principle-route-point" cx={x} cy={y} r="5" key={`${x}-${y}`}>
                  <animate
                    attributeName="opacity"
                    dur="8s"
                    repeatCount="indefinite"
                    values="0;0;.62;.62;0"
                    keyTimes={`0;${(0.1 + index * 0.056).toFixed(3)};${(0.12 + index * 0.056).toFixed(3)};.88;1`}
                  />
                </circle>
              ))}
            </g>
          </svg>
        </div>
        <header className="principle-heading">
          <div className="principle-heading-position">
            <div className="principle-heading-motion" style={getMotionStyle(0.0, 0.26, headingOffset)}>
              <p className="eyebrow"><span>01</span><span>PRODUCT CORE</span></p>
              <h2><span>Built for real group</span><strong>decisions.</strong></h2>
            </div>
          </div>
        </header>

        {principles.map((principle, index) => (
          <div className={`principle-line ${principle.tone}`} key={principle.key}>
            <div className="principle-mask">
              <div className="principle-item-position">
                <div
                  className="principle-word principle-item-motion"
                  style={getMotionStyle(principle.range[0], principle.range[1], itemOffsets[index])}
                >
                  <span>{principle.symbol}</span>
                  <strong>{principle.word}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}

        <footer className="principle-transition">
          <div className="principle-transition-position">
            <div className="principle-transition-motion" style={getMotionStyle(0.86, 1.0, transitionOffset)}>
              <p>AI generates. Rules validate. People decide.</p>
              <i aria-hidden="true" style={{ height: `${18 + lineReveal * 48}px` }} />
              <a href="#process">
                <span>HOW TRIPSYNC WORKS</span>
                <strong>Five steps. One decision.</strong>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
