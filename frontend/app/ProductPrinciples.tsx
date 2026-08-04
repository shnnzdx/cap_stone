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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.22 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`principle-stage ${visible ? "is-visible" : ""}`} ref={sectionRef} aria-label="TripSync core product principles">
      {principles.map((principle, index) => (
        <div className={`principle-line ${principle.tone}`} style={{ "--principle-delay": `${index * 190}ms` } as React.CSSProperties} key={principle.word}>
          <div className="principle-mask">
            <div className="principle-word"><span>{principle.symbol}</span><strong>{principle.word}</strong><small>{principle.number}</small></div>
          </div>
        </div>
      ))}
    </div>
  );
}
