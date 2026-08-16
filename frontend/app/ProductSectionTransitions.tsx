"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function ProductSectionTransitions() {
  useGSAP(() => {
    const decision = document.querySelector<HTMLElement>(".product-overview");
    const decisionStage = document.querySelector<HTMLElement>(".principle-stage");
    const particleMap = document.querySelector<HTMLElement>(".idea-sphere-canvas");
    const shared = document.querySelector<HTMLElement>(".people-v2");
    const revealSurface = document.querySelector<HTMLElement>(".shared-needs-reveal-surface");
    const sharedEyebrow = document.querySelector<HTMLElement>(".people-v2__eyebrow");
    const sharedTitle = document.querySelector<HTMLElement>(".people-v2__title");
    const audiencePanel = document.querySelector<HTMLElement>(".people-v2__audiences");
    const audiences = gsap.utils.toArray<HTMLElement>(".people-v2__audience");
    const audienceIcons = gsap.utils.toArray<HTMLElement>(".people-v2__audience-icon");
    const audienceDescriptions = gsap.utils.toArray<HTMLElement>(".people-v2__audience-copy p");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (decision && decisionStage && particleMap && shared && revealSurface && sharedEyebrow && sharedTitle && audiences.length) {
      if (reduced) {
        gsap.set([shared, decisionStage, particleMap, sharedEyebrow, sharedTitle, ...audiences, ...audienceIcons, ...audienceDescriptions], { clearProps: "all" });
        gsap.set(revealSurface, { autoAlpha: 0 });
      } else {
        const initialWindow = "inset(100% 0 0 0)";

        gsap.set(revealSurface, { autoAlpha: 0, clipPath: initialWindow });
        gsap.set(shared, { "--people-section-surface": "transparent" });
        gsap.set(sharedEyebrow, { autoAlpha: 0, y: 8 });
        gsap.set(sharedTitle, { autoAlpha: 0, y: 8, scale: 0.995, clipPath: "inset(0 0 100% 0)", transformOrigin: "left center" });

        const revealTimeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: shared,
            start: "top bottom",
            end: "top 10%",
            scrub: 0.52,
            invalidateOnRefresh: true,
            onEnter: () => gsap.set(revealSurface, { autoAlpha: 1 }),
            onEnterBack: () => gsap.set(revealSurface, { autoAlpha: 1 }),
            onLeaveBack: () => gsap.set(revealSurface, { autoAlpha: 0 }),
          },
        })
          .fromTo(revealSurface, {
            clipPath: initialWindow,
          }, {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 0.9,
          }, 0)
          .to(decisionStage, { y: -18, scale: 0.988, autoAlpha: 0.5, transformOrigin: "center top", duration: 0.8 }, 0)
          .to(particleMap, { y: -10, autoAlpha: 0.12, scale: 0.988, duration: 0.62 }, 0.04)
          .to(sharedEyebrow, { autoAlpha: 1, y: 0, duration: 0.13 }, 0.44)
          .to(sharedTitle, { autoAlpha: 1, y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", duration: 0.18 }, 0.56)
          .set(shared, { "--people-section-surface": "var(--surface-people)" }, 0.92)
          .to(revealSurface, { autoAlpha: 0, duration: 0.04 }, 0.96);

        if (audiencePanel) {
          const gatheredTransform = (index: number) => {
            const panelRect = audiencePanel.getBoundingClientRect();
            const cardRect = audiences[index].getBoundingClientRect();
            const mobile = window.innerWidth <= 820;

            if (mobile) {
              return {
                x: index === 0 ? 10 : index === 2 ? -10 : 0,
                y: index === 0 ? 30 : index === 2 ? -30 : 0,
                rotation: index === 0 ? -0.25 : index === 2 ? 0.25 : 0,
                scale: 0.98,
              };
            }

            const panelCenter = panelRect.left + panelRect.width / 2;
            const cardCenter = cardRect.left + cardRect.width / 2;
            const spread = Math.min(74, panelRect.width * 0.065);

            return {
              x: panelCenter - cardCenter + (index - 1) * spread,
              y: (index - 1) * 10,
              rotation: (index - 1) * 0.35,
              scale: 0.97,
            };
          };

          gsap.set(audienceIcons, { autoAlpha: 0.58 });
          gsap.set(audienceDescriptions, { autoAlpha: 0.5, y: 5, clipPath: "inset(0 0 22% 0)" });

          gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: audiencePanel,
              start: "top 72%",
              end: "top 30%",
              scrub: 0.58,
              invalidateOnRefresh: true,
            },
          })
            .set(audiences, {
              x: (index) => gatheredTransform(index).x,
              y: (index) => gatheredTransform(index).y,
              rotation: (index) => gatheredTransform(index).rotation,
              scale: (index) => gatheredTransform(index).scale,
              autoAlpha: 0.78,
              "--gather-wash": 0.72,
              transformOrigin: "center center",
            }, 0)
            .to(audiences, {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              autoAlpha: 1,
              duration: 0.45,
            }, 0.2)
            .to(audiences, {
              "--gather-wash": 0,
              duration: 0.28,
              stagger: 0.035,
            }, 0.5)
            .to(audienceIcons, {
              autoAlpha: 1,
              duration: 0.22,
              stagger: 0.035,
            }, 0.6)
            .to(audienceDescriptions, {
              autoAlpha: 1,
              y: 0,
              clipPath: "inset(0 0 0% 0)",
              duration: 0.25,
              stagger: 0.035,
            }, 0.62);
        }
      }
    }

    const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(refresh);
  }, []);

  return <div className="shared-needs-reveal-surface" aria-hidden="true" />;
}
