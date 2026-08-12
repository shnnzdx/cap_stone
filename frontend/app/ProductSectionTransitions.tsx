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
    const audiences = gsap.utils.toArray<HTMLElement>(".people-v2__audience");
    const audienceIcons = gsap.utils.toArray<HTMLElement>(".people-v2__audience-icon");
    const audienceDescriptions = gsap.utils.toArray<HTMLElement>(".people-v2__audience-copy p");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const productPage = document.querySelector<HTMLElement>(".product-page");
    const sectionRadius = Number.parseFloat(productPage ? getComputedStyle(productPage).getPropertyValue("--radius-section") : "28") || 28;

    if (decision && decisionStage && particleMap && shared && revealSurface && sharedEyebrow && sharedTitle && audiences.length) {
      if (reduced) {
        gsap.set([shared, decisionStage, particleMap, sharedEyebrow, sharedTitle, ...audiences, ...audienceIcons, ...audienceDescriptions], { clearProps: "all" });
        gsap.set(revealSurface, { autoAlpha: 0 });
      } else {
        const initialWindow = () => {
          const mobile = window.innerWidth <= 760;
          const width = mobile ? Math.min(220, window.innerWidth * 0.62) : Math.min(280, Math.max(240, window.innerWidth * 0.15));
          const height = mobile ? 140 : Math.min(180, Math.max(150, window.innerHeight * 0.18));
          const centerX = window.innerWidth * (mobile ? 0.58 : 0.64);
          const centerY = window.innerHeight * (mobile ? 0.66 : 0.64);

          return `inset(${Math.max(0, centerY - height / 2)}px ${Math.max(0, window.innerWidth - centerX - width / 2)}px ${Math.max(0, window.innerHeight - centerY - height / 2)}px ${Math.max(0, centerX - width / 2)}px round ${sectionRadius}px)`;
        };

        gsap.set(revealSurface, { autoAlpha: 0, clipPath: initialWindow });
        gsap.set(shared, { "--people-section-surface": "transparent" });
        gsap.set(sharedEyebrow, { autoAlpha: 0, y: 8 });
        gsap.set(sharedTitle, { autoAlpha: 0, y: 8, scale: 0.995, clipPath: "inset(0 0 100% 0)", transformOrigin: "left center" });
        gsap.set(audiences, { autoAlpha: 0.66, y: 5, scale: 0.995, rotate: 0, transformOrigin: "center" });
        gsap.set(audienceIcons, { autoAlpha: 0.58 });
        gsap.set(audienceDescriptions, { autoAlpha: 0, y: 4, clipPath: "inset(0 0 100% 0)" });

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
            clipPath: "inset(0% 0% 0% 0% round 0px 0px 0px 0px)",
            duration: 0.72,
          }, 0)
          .to(decisionStage, { scale: 0.982, autoAlpha: 0.58, transformOrigin: "center top", duration: 0.68 }, 0)
          .to(particleMap, { autoAlpha: 0.12, scale: 0.984, duration: 0.5 }, 0.04)
          .to(sharedEyebrow, { autoAlpha: 1, y: 0, duration: 0.13 }, 0.44)
          .to(sharedTitle, { autoAlpha: 1, y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", duration: 0.18 }, 0.56)
          .to(audiences, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.18,
            stagger: 0.065,
          }, 0.7)
          .to(audienceIcons, { autoAlpha: 1, duration: 0.13, stagger: 0.065 }, 0.72)
          .to(audienceDescriptions, {
            autoAlpha: 1,
            y: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.16,
            stagger: 0.065,
          }, 0.76)
          .set(shared, { "--people-section-surface": "var(--surface-people)" }, 0.92)
          .to(revealSurface, { autoAlpha: 0, duration: 0.04 }, 0.96);

      }
    }

    const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(refresh);
  }, []);

  return <div className="shared-needs-reveal-surface" aria-hidden="true" />;
}
