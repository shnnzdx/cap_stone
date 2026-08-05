"use client";

import { useEffect, useRef, useState } from "react";

const principles = [
  { word: "Validate", symbol: "✓", tone: "validate", range: [0.05, 0.34] },
  { word: "Protect", symbol: "▣", tone: "protect", range: [0.22, 0.51] },
  { word: "Explain", symbol: "⌁", tone: "explain", range: [0.39, 0.68] },
  { word: "Confirm", symbol: "✓✓", tone: "confirm", range: [0.56, 0.85] },
];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
    let frame = 0, target = 0, current = 0;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      target = clamp(-rect.top / distance);
    };
    const render = () => { current += (target - current) * .1; if (Math.abs(target-current) < .0005) current = target; setProgress(current); frame = requestAnimationFrame(render); };
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
        <header className="principle-intro">
          <p className="eyebrow">01 · PRODUCT CORE</p>
          <h2>Built for real group decisions.</h2>
        </header>
        {principles.map((principle) => {
          const reveal = clamp((progress - principle.range[0]) / (principle.range[1] - principle.range[0]));
          return <div className={`principle-line ${principle.tone}`} key={principle.word}><div className="principle-mask">
            <div className="principle-word" style={{ opacity: reveal === 0 ? 0 : .7 + reveal * .3, clipPath: `inset(${(1 - reveal) * 100}% 0 0 0)`, transform: `translateY(${(1 - reveal) * 108}px) scale(${.985 + reveal * .015})`, visibility: reveal === 0 ? "hidden" : "visible" }}><span>{principle.symbol}</span><strong>{principle.word}</strong></div>
          </div></div>;
        })}
        <footer className="principle-transition" style={{opacity:.12+clamp((progress-.82)/.18)*.88,transform:`translate(-50%,${(1-clamp((progress-.82)/.18))*24}px)`}}><i /><a href="#process"><span>HOW TRIPSYNC WORKS</span><strong>Five steps. One decision.</strong></a></footer>
      </div>
    </div>
  );
}
