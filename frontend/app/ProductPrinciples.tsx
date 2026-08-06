"use client";

import { useEffect, useRef, useState } from "react";

const principles = [
  { word: "Validate", symbol: "✓", tone: "validate", range: [0.05, 0.28] },
  { word: "Protect", symbol: "▣", tone: "protect", range: [0.23, 0.46] },
  { word: "Explain", symbol: "⌁", tone: "explain", range: [0.41, 0.64] },
  { word: "Confirm", symbol: "✓✓", tone: "confirm", range: [0.59, 0.82] },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    let frame = 0;
    let target = 0;
    let current = 0;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      target = clamp(-rect.top / distance);
    };

    const render = () => {
      current += (target - current) * 0.1;
      if (Math.abs(target - current) < 0.0005) current = target;
      setProgress(current);
      frame = requestAnimationFrame(render);
    };

    const onScroll = () => update();
    update();
    frame = requestAnimationFrame(render);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="principle-scroll" ref={sectionRef} aria-label="TripSync core product principles">
      <div className="principle-stage">
        <header className="principle-heading">
          <p className="eyebrow">01 · PRODUCT CORE</p>
          <h2>Built for real group decisions.</h2>
        </header>
        {principles.map((principle, index) => {
          const [start, end] = principle.range;
          const reveal = clamp((progress - start) / (end - start));
          return (
            <div className={`principle-line ${principle.tone}`} key={principle.word}>
              <div className="principle-mask">
                <div
                  className="principle-word"
                  style={{
                    opacity: 0.32 + reveal * 0.68,
                    transform: `translateY(${(1 - reveal) * ((principles.length - 1 - index) * 86 + 76)}px) scale(${0.985 + reveal * 0.015})`,
                  }}
                >
                  <span>{principle.symbol}</span>
                  <strong>{principle.word}</strong>
                </div>
              </div>
            </div>
          );
        })}
        <footer
          className="principle-transition"
          style={
            {
              "--transition-opacity": 0.12 + clamp((progress - 0.82) / 0.18) * 0.88,
              "--transition-y": `${(1 - clamp((progress - 0.82) / 0.18)) * 24}px`,
              "--route-height": `${18 + clamp((progress - 0.82) / 0.18) * 48}px`,
            } as React.CSSProperties
          }
        >
          <p>AI generates. Rules validate. People decide.</p>
          <i aria-hidden="true" />
          <a href="#process">
            <span>HOW TRIPSYNC WORKS</span>
            <strong>Five steps. One decision.</strong>
          </a>
        </footer>
      </div>
    </div>
  );
}
