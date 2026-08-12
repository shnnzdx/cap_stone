"use client";

import { useRef, type MutableRefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { IdeaSphereStoryMotion } from "./IdeaSphereCanvas";
import { productPrinciples } from "../../shared/tripsync-product-content.js";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const principles = productPrinciples;

type ProductPrinciplesProps = {
  storyMotionRef: MutableRefObject<IdeaSphereStoryMotion>;
};

type FocusPoint = {
  x: number;
  y: number;
};

export default function ProductPrinciples({ storyMotionRef }: ProductPrinciplesProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const focusTargetsRef = useRef<Record<string, FocusPoint>>({});

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stage = root.querySelector<HTMLElement>(".principle-stage");
    const headingKicker = root.querySelector<HTMLElement>(".principle-heading .eyebrow");
    const heading = root.querySelector<HTMLElement>(".principle-heading h2");
    const lines = principles
      .map((principle) => root.querySelector<HTMLElement>(`[data-principle="${principle.key}"]`))
      .filter((line): line is HTMLElement => Boolean(line));
    const symbols = lines
      .map((line) => line.querySelector<HTMLElement>(".principle-symbol"))
      .filter((symbol): symbol is HTMLElement => Boolean(symbol));
    const words = lines
      .map((line) => line.querySelector<HTMLElement>("h3"))
      .filter((word): word is HTMLElement => Boolean(word));
    const descriptions = lines
      .map((line) => line.querySelector<HTMLElement>("p"))
      .filter((description): description is HTMLElement => Boolean(description));
    const clampNdc = gsap.utils.clamp(-0.92, 0.92);
    const motion = storyMotionRef.current;
    let timeline: gsap.core.Timeline | null = null;
    let resizeFrame = 0;

    const measureFocusTargets = () => {
      if (!stage) return;

      const stageRect = stage.getBoundingClientRect();
      const stageStyle = window.getComputedStyle(stage);
      const stickyTop = Number.parseFloat(stageStyle.top) || 0;
      const nextTargets: Record<string, FocusPoint> = {};
      for (const principle of principles) {
        const element = root.querySelector<HTMLElement>(`[data-principle="${principle.key}"]`);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const relativeCenterX = rect.left - stageRect.left + rect.width / 2;
        const relativeCenterY = rect.top - stageRect.top + rect.height / 2;
        const centerX = stageRect.left + relativeCenterX;
        const centerY = stickyTop + relativeCenterY;

        nextTargets[principle.key] = {
          x: clampNdc((centerX / window.innerWidth) * 2 - 1 + principle.focusOffset.x),
          y: clampNdc(1 - (centerY / window.innerHeight) * 2 + principle.focusOffset.y),
        };
      }

      focusTargetsRef.current = nextTargets;
    };

    const focusStrengthScale = () => {
      if (window.innerWidth < 620) return 0.48;
      if (window.innerWidth < 980) return 0.82;
      return 1;
    };
    const focusFor = (key: string) => focusTargetsRef.current[key] ?? { x: 0, y: 0 };
    const focusTween = (key: string, strength: number, duration: number) => ({
      principleFocusX: () => focusFor(key).x,
      principleFocusY: () => focusFor(key).y,
      principleFocusStrength: () => strength * focusStrengthScale(),
      duration,
    });
    const resetFocus = () => {
      motion.principleFocusStrength = 0;
      motion.principleFocusX = 0;
      motion.principleFocusY = 0;
    };
    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        measureFocusTargets();
        timeline?.invalidate();
      });
    };

    measureFocusTargets();
    window.addEventListener("resize", onResize);

    if (reduceMotionQuery.matches) {
      gsap.set([headingKicker, heading, ...lines, ...symbols, ...words, ...descriptions], { clearProps: "all" });
      resetFocus();
      return () => {
        cancelAnimationFrame(resizeFrame);
        window.removeEventListener("resize", onResize);
      };
    }

    gsap.set([headingKicker, heading, ...lines, ...symbols, ...words, ...descriptions], { autoAlpha: 1 });
    gsap.set(headingKicker, { autoAlpha: 0, y: 8 });
    gsap.set(heading, { autoAlpha: 0, y: 22, scale: 0.995 });
    gsap.set(lines, { autoAlpha: 0, scale: 0.985 });
    gsap.set(symbols, { autoAlpha: 0, y: 10, scale: 0.96 });
    gsap.set(words, { autoAlpha: 0, y: 20, scale: 0.985 });
    gsap.set(descriptions, { autoAlpha: 0, y: 14 });

    timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top 82%",
        end: "bottom 18%",
        scrub: 0.72,
        invalidateOnRefresh: true,
        refreshPriority: 1,
        onRefresh: () => {
          measureFocusTargets();
          timeline?.invalidate();
        },
        onLeaveBack: resetFocus,
      },
    });

    timeline
      .to({}, { duration: 0.025 }, 0)
      .to(headingKicker, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.025)
      .to(heading, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14 }, 0.06);

    const activatePrinciple = (index: number, start: number, peakStrength: number) => {
      const principle = principles[index];
      const line = lines[index];
      const symbol = symbols[index];
      const word = words[index];
      const description = descriptions[index];
      if (!line || !symbol || !word || !description) return;

      const previous = lines.slice(0, index);
      if (previous.length) {
        timeline?.to(previous, { autoAlpha: 0.66, scale: 0.99, duration: 0.1 }, start + 0.035);
      }

      timeline
        ?.to(motion, focusTween(principle.key, peakStrength, 0.12), start)
        .to(line, { autoAlpha: 1, scale: 1, duration: 0.08 }, start)
        .fromTo(
          symbol,
          { autoAlpha: 0, x: principle.entryX * 0.35, y: 10, scale: 0.96 },
          { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.1 },
          start,
        )
        .fromTo(
          word,
          { autoAlpha: 0, x: principle.entryX, y: 20, scale: 0.985 },
          { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.12 },
          start + 0.02,
        )
        .fromTo(
          description,
          { autoAlpha: 0, x: principle.entryX * 0.45, y: 14 },
          { autoAlpha: 1, x: 0, y: 0, duration: 0.11 },
          start + 0.055,
        )
        .to(line, { autoAlpha: 1, scale: 1, duration: 0.1 }, start + 0.08)
        .to(motion, { principleFocusStrength: () => 0.22 * focusStrengthScale(), duration: 0.11 }, start + 0.135);
    };

    activatePrinciple(0, 0.15, 0.78);
    activatePrinciple(1, 0.31, 0.82);
    activatePrinciple(2, 0.47, 0.76);
    activatePrinciple(3, 0.63, 0.82);

    timeline
      .to(lines, { autoAlpha: 0.94, scale: 1, duration: 0.1, stagger: 0.01 }, 0.86)
      .to(descriptions, { autoAlpha: 1, duration: 0.08 }, 0.86)
      .to(motion, { principleFocusStrength: () => 0.16 * focusStrengthScale(), duration: 0.08 }, 0.88)
      .to({}, { duration: 0.18 }, 0.94);

    return () => {
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", onResize);
      resetFocus();
    };
  }, { scope: rootRef });

  return (
    <div className="principle-scroll" aria-label="Decision system for group planning" ref={rootRef}>
      <div className="principle-stage">
        <header className="principle-heading">
          <p className="eyebrow"><span>01</span><span>DECISION SYSTEM</span></p>
          <h2><span>Better group</span> <strong>decisions.</strong></h2>
        </header>

        <div className="principle-anchor-field">
          {principles.map((principle) => (
            <article
              className={`principle-line principle-line--${principle.tone}`}
              data-principle={principle.key}
              key={principle.key}
            >
              <div className="principle-word">
                <span className="principle-symbol" aria-hidden="true">{principle.symbol}</span>
                <h3>{principle.word}</h3>
                <p>{principle.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
