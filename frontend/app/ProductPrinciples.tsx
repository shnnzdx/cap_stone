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

type MotionMetrics = {
  heading: number;
  items: number[];
  transition: number;
};

export default function ProductPrinciples() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<HTMLDivElement>(null);
  const principleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<MotionMetrics>({
    heading: 0,
    items: principles.map(() => 0),
    transition: 0,
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setProgress(1);
      return;
    }

    let progressFrame = 0;
    let measureFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const measureNodeOffset = (node: HTMLDivElement | null) => {
      if (!node) return 0;
      const rect = node.getBoundingClientRect();
      return Math.max(window.innerHeight - rect.top + 40, 0);
    };

    const measureOffsets = () => {
      setMetrics({
        heading: measureNodeOffset(headingRef.current),
        items: principles.map((_, index) => measureNodeOffset(principleRefs.current[index])),
        transition: measureNodeOffset(transitionRef.current),
      });
    };

    const scheduleMeasure = () => {
      if (measureFrame) cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => {
        measureOffsets();
        measureFrame = 0;
      });
    };

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
    scheduleMeasure();

    const observedNodes = [
      section,
      headingRef.current,
      transitionRef.current,
      ...principleRefs.current,
    ].filter(Boolean) as HTMLDivElement[];

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => scheduleMeasure());
      observedNodes.forEach((node) => resizeObserver?.observe(node));
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("load", scheduleMeasure);
    document.fonts?.ready.then(() => scheduleMeasure()).catch(() => {});

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("load", scheduleMeasure);
      resizeObserver?.disconnect();
      cancelAnimationFrame(progressFrame);
      cancelAnimationFrame(measureFrame);
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
        <header className="principle-heading">
          <div className="principle-heading-position" ref={headingRef}>
            <div className="principle-heading-motion" style={getMotionStyle(0.0, 0.26, metrics.heading)}>
              <p className="eyebrow"><span>01</span><span>PRODUCT CORE</span></p>
              <h2><span>Built for real group</span><strong>decisions.</strong></h2>
            </div>
          </div>
        </header>

        {principles.map((principle, index) => (
          <div className={`principle-line ${principle.tone}`} key={principle.key}>
            <div className="principle-mask">
              <div
                className="principle-item-position"
                ref={(node) => {
                  principleRefs.current[index] = node;
                }}
              >
                <div
                  className="principle-word principle-item-motion"
                  style={getMotionStyle(principle.range[0], principle.range[1], metrics.items[index] ?? 0)}
                >
                  <span>{principle.symbol}</span>
                  <strong>{principle.word}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}

        <footer className="principle-transition">
          <div className="principle-transition-position" ref={transitionRef}>
            <div className="principle-transition-motion" style={getMotionStyle(0.86, 1.0, metrics.transition)}>
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
