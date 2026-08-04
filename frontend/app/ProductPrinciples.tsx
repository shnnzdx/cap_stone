"use client";

import { useEffect, useRef, useState } from "react";

const principles = [
  { number: "01", word: "Validate", symbol: "✓", tone: "validate" },
  { number: "02", word: "Protect", symbol: "◉", tone: "protect" },
  { number: "03", word: "Explain", symbol: "↗", tone: "explain" },
  { number: "04", word: "Confirm", symbol: "+", tone: "confirm" },
];

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
    let frame = 0;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      setProgress(Math.max(0, Math.min(1, -rect.top / distance)));
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div className="principle-scroll" ref={sectionRef} aria-label="TripSync core product principles">
      <div className="principle-stage">
        {principles.map((principle, index) => {
          const reveal = Math.max(0, Math.min(1, (progress * 4 - index) * 1.35));
          return <div className={`principle-line ${principle.tone}`} key={principle.word}><div className="principle-mask">
            <div className="principle-word" style={{ opacity: .08 + reveal * .92, transform: `translateY(${(1 - reveal) * 112}%) scale(${.985 + reveal * .015})` }}><span style={{ transform: `scale(${.84 + reveal * .16})` }}>{principle.symbol}</span><strong>{principle.word}</strong><small>{principle.number}</small></div>
          </div></div>;
        })}
      </div>
    </div>
  );
}
