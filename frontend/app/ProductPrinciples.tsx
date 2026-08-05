"use client";

import { useEffect, useRef, useState } from "react";

const principles = [
  { number: "01", word: "Validate", symbol: "✓", tone: "validate", range: [0.05, 0.34] },
  { number: "02", word: "Protect", symbol: "▣", tone: "protect", range: [0.22, 0.51] },
  { number: "03", word: "Explain", symbol: "⌁", tone: "explain", range: [0.39, 0.68] },
  { number: "04", word: "Confirm", symbol: "✓✓", tone: "confirm", range: [0.56, 0.85] },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
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
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div className="principle-scroll" ref={sectionRef} aria-label="TripSync core product principles">
      <div className="principle-stage">
        {principles.map((principle) => {
          const [start, end] = principle.range;
          const reveal = clamp((progress - start) / (end - start));
          return <div className={`principle-line ${principle.tone}`} key={principle.word}><div className="principle-mask">
            <div className="principle-word" style={{ opacity: .32 + reveal * .68, transform: `translateY(${(1 - reveal) * 62}px) scale(${.985 + reveal * .015})` }}><span>{principle.symbol}</span><strong>{principle.word}</strong><small>{principle.number}</small></div>
          </div></div>;
        })}
      </div>
    </div>
  );
}
