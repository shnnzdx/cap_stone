"use client";

import { type MutableRefObject, type Ref, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { BrandConstellation, HeroAbsorptionLayer, HeroInputCluster, HeroSharedPlan } from "./ui";
import type { IdeaSphereStoryMotion } from "./IdeaSphereCanvas";
import type { RestingAnchorGeometry } from "./HomeIntroSequence";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type HeroStoryProps = {
  storyMotionRef: MutableRefObject<IdeaSphereStoryMotion>;
  sphereAnchorRef?: Ref<HTMLDivElement>;
  visualStageRef?: MutableRefObject<HTMLDivElement | null>;
  restingAnchorGeometryRef?: MutableRefObject<RestingAnchorGeometry | null>;
};

export default function HeroStory({
  storyMotionRef,
  sphereAnchorRef,
  visualStageRef,
  restingAnchorGeometryRef,
}: HeroStoryProps) {
  const heroRef = useRef<HTMLElement | null>(null);

  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = heroRef.current;
    const intro = hero?.closest(".intro-story");
    const visualStage = visualStageRef?.current;

    if (!hero || !visualStage) return;

    storyMotionRef.current.expansion = 1;
    storyMotionRef.current.absorption = 0;
    storyMotionRef.current.rotationDamp = 1;
    storyMotionRef.current.shatter = 0;
    storyMotionRef.current.mapProgress = 0;
    storyMotionRef.current.mapPresence = 1;

    const targets = [
      ".hero-copy>.eyebrow",
      ".hero-copy h1",
      ".voice-cluster-label",
      ".voice-item",
      ".voice-collector",
      ".voice-handoff",
      ".shared-plan-card",
      ".plan-kicker",
      ".shared-plan-card h2",
      ".plan-row",
      ".travel-token",
      ".hero-absorption-layer",
      ".absorption-fragment",
      ".hero-actions",
    ];

    if (reduceMotion) {
      gsap.set(targets, { clearProps: "all" });
      gsap.set(visualStage, { clearProps: "opacity,visibility,scale,x,y" });
      const reducedTl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: "bottom bottom",
          end: "+=90%",
          scrub: 0.35,
          invalidateOnRefresh: true,
        },
      });

      reducedTl
        .to(".hero-actions", { autoAlpha: 0, y: 10, duration: 0.18, ease: "none" }, 0)
        .to(".hero-copy>.eyebrow, .hero-copy h1", { autoAlpha: 0, y: -16, duration: 0.22, ease: "none" }, 0.08)
        .to(".hero-scene", { autoAlpha: 0.92, duration: 0.2, ease: "none" }, 0.18)
        .to(storyMotionRef.current, {
          expansion: 1,
          absorption: 1,
          rotationDamp: 0,
          shatter: 0,
          mapProgress: 1,
          mapPresence: 1,
          duration: 0.45,
          ease: "none",
        }, 0.42)
        .to({}, { duration: 0.001 }, 1);
      return;
    }

    const tl = gsap.timeline({
      defaults: {
        ease: "power2.out",
      },
    });

    tl.from(".hero-copy>.eyebrow", {
      autoAlpha: 0,
      y: 10,
      duration: 0.45,
    }, 0)
      .from(".hero-copy h1", {
        autoAlpha: 0,
        y: 24,
        scale: 0.995,
        duration: 0.72,
      }, 0.05)
      .from(visualStage, {
        autoAlpha: 0,
        scale: 0.985,
        duration: 0.9,
      }, 0.15)
      .from(".voice-cluster-label", {
        autoAlpha: 0,
        y: 8,
        duration: 0.46,
      }, 0.26)
      .from(".voice-item", {
        autoAlpha: 0,
        x: (index) => [-24, -18, -22, -16, -20, -14][index] ?? -18,
        y: (index) => [6, 4, 5, 3, 5, 3][index] ?? 4,
        scale: 0.985,
        duration: 0.52,
        stagger: 0.085,
      }, 0.3)
      .from(".voice-collector", {
        autoAlpha: 0,
        scaleY: 0,
        transformOrigin: "top center",
        duration: 0.68,
      }, 0.62)
      .from(".voice-handoff", {
        autoAlpha: 0,
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.52,
      }, 0.76)
      .from(".shared-plan-card", {
        autoAlpha: 0,
        x: 20,
        scale: 0.99,
        duration: 0.68,
      }, 0.82)
      .from(".plan-kicker, .shared-plan-card h2", {
        autoAlpha: 0,
        y: 7,
        duration: 0.38,
        stagger: 0.06,
      }, 0.96)
      .from(".plan-row", {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        stagger: 0.055,
      }, 1.05)
      .from(".travel-token", {
        autoAlpha: 0,
        y: 8,
        scale: 0.985,
        duration: 0.45,
      }, 1.12)
      .from(".hero-actions", {
        autoAlpha: 0,
        y: 15,
        duration: 0.58,
      }, 1.22);

    const sphereStage = hero.querySelector<HTMLElement>(".idea-sphere-anchor");
    const scene = hero.querySelector<HTMLElement>(".hero-scene");
    const finalSphereExpansion = () => window.innerWidth < 620 ? 1.22 : window.innerWidth < 900 ? 1.38 : 1.58;
    const shatterSphereExpansion = () => finalSphereExpansion() + (window.innerWidth < 620 ? 0 : window.innerWidth < 900 ? 0.03 : 0.04);
    const mapAssemblyExpansion = () => window.innerWidth < 620 ? 1.08 : window.innerWidth < 900 ? 1.12 : 1.18;
    const finalMapExpansion = () => 1;
    const scrollDistance = () => window.innerWidth < 620 ? "+=325%" : window.innerWidth < 900 ? "+=370%" : "+=430%";
    const lateFieldYOffset = () => {
      const baseline = restingAnchorGeometryRef?.current;
      const stageRect = visualStage.getBoundingClientRect();
      const currentY = Number(gsap.getProperty(visualStage, "y")) || 0;
      const baseTop = baseline?.top ?? stageRect.top - currentY;
      const baseHeight = baseline?.height ?? stageRect.height;
      const baseStageCenter = baseTop + baseHeight / 2;
      const viewportCenter = window.innerHeight / 2;
      const targetY = viewportCenter - baseStageCenter;
      const upwardLimit = window.innerWidth < 900 ? window.innerHeight * 0.36 : window.innerHeight * 0.34;
      const downwardLimit = window.innerWidth < 900 ? window.innerHeight * 0.2 : window.innerHeight * 0.18;

      return gsap.utils.clamp(-upwardLimit, downwardLimit, targetY);
    };
    const finalMapOpticalYOffset = () => {
      return window.innerWidth < 900 ? window.innerHeight * 0.006 : window.innerHeight * 0.008;
    };

    const vectorFor = (item: HTMLElement, strength: number, limitX: number) => {
      if (!sphereStage) return { x: 0, y: 0 };

      const sphereRect = sphereStage.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const sphereCenterX = sphereRect.left + sphereRect.width / 2;
      const sphereCenterY = sphereRect.top + sphereRect.height / 2;
      const itemCenterX = itemRect.left + itemRect.width / 2;
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const x = gsap.utils.clamp(16, limitX, (sphereCenterX - itemCenterX) * strength);
      const y = gsap.utils.clamp(-14, 14, (sphereCenterY - itemCenterY) * strength);

      return { x, y };
    };

    const strongVectorFor = (item: HTMLElement, strength: number, limitX: number) => {
      if (!sphereStage) return { x: 0, y: 0 };

      const sphereRect = sphereStage.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const sphereCenterX = sphereRect.left + sphereRect.width / 2;
      const sphereCenterY = sphereRect.top + sphereRect.height / 2;
      const itemCenterX = itemRect.left + itemRect.width / 2;
      const itemCenterY = itemRect.top + itemRect.height / 2;

      return {
        x: gsap.utils.clamp(34, limitX, (sphereCenterX - itemCenterX) * strength),
        y: gsap.utils.clamp(-34, 34, (sphereCenterY - itemCenterY) * strength),
      };
    };

    const fragmentPoint = (fragment: HTMLElement, phase: "start" | "release" | "control" | "target") => {
      const sourceName = fragment.dataset.source;
      if (!scene || !sphereStage || !sourceName) return { x: 0, y: 0 };

      const source = hero.querySelector<HTMLElement>(`.${sourceName}`);
      if (!source) return { x: 0, y: 0 };

      const sceneRect = scene.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();
      const sphereRect = sphereStage.getBoundingClientRect();
      const fx = Number.parseFloat(fragment.style.getPropertyValue("--fx")) || 0.5;
      const fy = Number.parseFloat(fragment.style.getPropertyValue("--fy")) || 0.5;
      const bend = Number.parseFloat(fragment.style.getPropertyValue("--fb")) || 0;
      const startX = sourceRect.left - sceneRect.left + sourceRect.width * (0.14 + fx * 0.72);
      const startY = sourceRect.top - sceneRect.top + sourceRect.height * (0.18 + fy * 0.64);
      const sphereX = sphereRect.left - sceneRect.left + sphereRect.width / 2;
      const sphereY = sphereRect.top - sceneRect.top + sphereRect.height / 2;
      const sourceAngle = Math.atan2(startY - sphereY, startX - sphereX);
      const sphereRadius = Math.min(sphereRect.width, sphereRect.height) * (0.26 + fx * 0.1);
      const targetX = sphereX + Math.cos(sourceAngle + bend * 0.18) * sphereRadius;
      const targetY = sphereY + Math.sin(sourceAngle + bend * 0.18) * sphereRadius;
      const localRelease = 18 + fx * 16;
      const releaseX = startX + Math.cos(sourceAngle) * localRelease + bend * 12;
      const releaseY = startY + Math.sin(sourceAngle) * localRelease - bend * 10;
      const midX = (releaseX + targetX) / 2;
      const midY = (releaseY + targetY) / 2;
      const dx = targetX - releaseX;
      const dy = targetY - releaseY;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const curve = 52 + Math.abs(bend) * 44;
      const controlX = midX + (-dy / length) * bend * curve;
      const controlY = midY + (dx / length) * bend * curve;

      if (phase === "release") return { x: releaseX, y: releaseY };
      if (phase === "control") return { x: controlX, y: controlY };
      if (phase === "target") return { x: targetX, y: targetY };
      return { x: startX, y: startY };
    };

    gsap.set(".voice-collector", { transformOrigin: "top center" });
    gsap.set(".voice-handoff", { transformOrigin: "left center" });
    gsap.set(".absorption-fragment", { autoAlpha: 0, scale: 0.8, transformOrigin: "center center" });

    const scrollTl = gsap.timeline({
      defaults: {
        ease: "none",
      },
      scrollTrigger: {
        trigger: hero,
        start: "bottom bottom",
        end: scrollDistance,
        scrub: 0.75,
        pin: true,
        anticipatePin: 0.6,
        invalidateOnRefresh: true,
        refreshPriority: 1,
        onUpdate: (self) => {
          if (self.progress > 0.015 && tl.progress() < 1) {
            tl.progress(1);
          }
          hero.classList.toggle("is-scroll-transitioning", self.progress > 0.08);
          hero.classList.toggle("is-hero-releasing", self.progress > 0.94);
          intro?.classList.toggle("is-scroll-transitioning", self.progress > 0.08);
          intro?.classList.toggle("is-field-recentering", self.progress > 0.56);
          intro?.classList.toggle("is-hero-releasing", self.progress > 0.94);
        },
        onLeaveBack: () => {
          hero.classList.remove("is-scroll-transitioning", "is-hero-releasing");
          intro?.classList.remove("is-scroll-transitioning", "is-field-recentering", "is-hero-releasing");
        },
      },
    });

    scrollTl
      .to(".hero-actions", {
        autoAlpha: 0,
        y: 14,
        duration: 0.1,
      }, 0)
      .to(".hero-copy>.eyebrow", {
        autoAlpha: 0,
        y: -20,
        duration: 0.08,
      }, 0.06)
      .to(".hero-copy h1", {
        autoAlpha: 0,
        y: -32,
        duration: 0.1,
      }, 0.08)
      .to(".voice-item", {
        x: (_index, target) => {
          const item = target as HTMLElement;
          const limit = item.classList.contains("voice-item--primary") ? 38 : item.classList.contains("voice-item--micro") ? 82 : 62;
          const strength = item.classList.contains("voice-item--primary") ? 0.18 : 0.24;
          return vectorFor(item, strength, limit).x;
        },
        y: (_index, target) => {
          const item = target as HTMLElement;
          const strength = item.classList.contains("voice-item--primary") ? 0.18 : 0.24;
          return vectorFor(item, strength, item.classList.contains("voice-item--primary") ? 38 : 62).y;
        },
        scale: (_index, target) => (target as HTMLElement).classList.contains("voice-item--primary") ? 0.985 : 0.976,
        autoAlpha: (index, target) => (target as HTMLElement).classList.contains("voice-item--micro") ? 0.82 : 0.9,
        duration: 0.28,
        stagger: {
          each: 0.035,
          from: "end",
        },
      }, 0.18)
      .to(".voice-collector", {
        autoAlpha: 0.34,
        scaleY: 0.82,
        duration: 0.22,
      }, 0.3)
      .to(".voice-handoff", {
        autoAlpha: 0.18,
        scaleX: 0.72,
        duration: 0.2,
      }, 0.32)
      .to(".hero-plan-group", {
        x: -34,
        y: 4,
        scale: 0.982,
        duration: 0.22,
      }, 0.28)
      .to(".travel-token", {
        x: -12,
        y: 4,
        autoAlpha: 0.72,
        duration: 0.18,
      }, 0.32)
      .to(storyMotionRef.current, {
        expansion: () => Math.min(finalSphereExpansion(), 1.32),
        absorption: 0.36,
        rotationDamp: 0.9,
        duration: 0.18,
      }, 0.58)
      .to(storyMotionRef.current, {
        expansion: finalSphereExpansion,
        absorption: 1,
        rotationDamp: 0.78,
        duration: 0.24,
      }, 0.72)
      .to(".voice-cluster-label", {
        autoAlpha: 0,
        y: -10,
        duration: 0.12,
      }, 0.44)
      .to(".voice-collector", {
        autoAlpha: 0,
        scaleY: 0.46,
        duration: 0.16,
      }, 0.46)
      .to(".voice-handoff", {
        autoAlpha: 0,
        scaleX: 0.34,
        duration: 0.16,
      }, 0.48)
      .to(".input-activities", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.42, 132).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.42, 132).y,
        scale: 0.86,
        autoAlpha: 0.56,
        duration: 0.14,
      }, 0.46)
      .to(".input-activities .voice-body", { autoAlpha: 0.28, duration: 0.1 }, 0.49)
      .to(".input-activities", { autoAlpha: 0, scale: 0.72, duration: 0.1 }, 0.62)
      .to(".input-accessibility", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.44, 150).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.44, 150).y,
        scale: 0.84,
        autoAlpha: 0.54,
        duration: 0.15,
      }, 0.49)
      .to(".input-accessibility .voice-body", { autoAlpha: 0.25, duration: 0.1 }, 0.52)
      .to(".input-accessibility", { autoAlpha: 0, scale: 0.7, duration: 0.1 }, 0.65)
      .to(".input-food", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.46, 152).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.46, 152).y,
        scale: 0.83,
        autoAlpha: 0.48,
        duration: 0.13,
      }, 0.51)
      .to(".input-food .voice-body", { autoAlpha: 0.22, duration: 0.09 }, 0.54)
      .to(".input-food", { autoAlpha: 0, scale: 0.68, duration: 0.1 }, 0.67)
      .to(".input-pace", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.45, 158).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.45, 158).y,
        scale: 0.85,
        autoAlpha: 0.54,
        duration: 0.15,
      }, 0.53)
      .to(".input-pace .voice-body", { autoAlpha: 0.26, duration: 0.1 }, 0.56)
      .to(".input-pace", { autoAlpha: 0, scale: 0.7, duration: 0.1 }, 0.7)
      .to(".input-dates", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.47, 166).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.47, 166).y,
        scale: 0.84,
        autoAlpha: 0.52,
        duration: 0.15,
      }, 0.56)
      .to(".input-dates .voice-body", { autoAlpha: 0.24, duration: 0.1 }, 0.59)
      .to(".input-dates", { autoAlpha: 0, scale: 0.69, duration: 0.1 }, 0.72)
      .to(".input-budget", {
        x: (_index, target) => strongVectorFor(target as HTMLElement, 0.48, 174).x,
        y: (_index, target) => strongVectorFor(target as HTMLElement, 0.48, 174).y,
        scale: 0.86,
        autoAlpha: 0.58,
        duration: 0.16,
      }, 0.59)
      .to(".input-budget .voice-body", { autoAlpha: 0.3, duration: 0.1 }, 0.62)
      .to(".input-budget", { autoAlpha: 0, scale: 0.72, duration: 0.1 }, 0.74)
      .to(".hero-plan-group", {
        x: -74,
        y: 2,
        scale: 0.91,
        duration: 0.24,
      }, 0.52)
      .to(".plan-row-0", { x: -20, scale: 0.9, autoAlpha: 0.16, duration: 0.11 }, 0.58)
      .to(".plan-row-1", { x: -26, scale: 0.88, autoAlpha: 0.14, duration: 0.11 }, 0.6)
      .to(".plan-row-2", { x: -32, scale: 0.86, autoAlpha: 0.12, duration: 0.11 }, 0.62)
      .to(".plan-row-3", { x: -38, scale: 0.85, autoAlpha: 0.1, duration: 0.11 }, 0.64)
      .to(".plan-row-4", { x: -44, scale: 0.84, autoAlpha: 0.08, duration: 0.11 }, 0.66)
      .to(".plan-kicker, .shared-plan-card h2", { autoAlpha: 0.1, y: -7, duration: 0.14 }, 0.68)
      .to(".plan-rows", { autoAlpha: 0, duration: 0.12 }, 0.72)
      .to(".travel-token", { x: -46, y: 8, scale: 0.82, autoAlpha: 0, duration: 0.13 }, 0.65)
      .to(".shared-plan-card", { x: -58, y: 2, scale: 0.82, autoAlpha: 0, duration: 0.12 }, 0.71)
      .to(".hero-input-cluster", { autoAlpha: 0, duration: 0.06 }, 0.76)
      .to(".hero-plan-group", { autoAlpha: 0, duration: 0.06 }, 0.77)
      .to(storyMotionRef.current, {
        shatter: 0.08,
        rotationDamp: 0.62,
        duration: 0.1,
      }, 1.04)
      .to(storyMotionRef.current, {
        shatter: 0.28,
        rotationDamp: 0.5,
        expansion: shatterSphereExpansion,
        duration: 0.12,
      }, 1.08)
      .to(visualStage, {
        y: () => lateFieldYOffset() * 0.36,
        duration: 0.18,
      }, 1.1)
      .to(storyMotionRef.current, {
        shatter: 0.62,
        rotationDamp: 0.34,
        duration: 0.15,
      }, 1.16)
      .to(storyMotionRef.current, {
        shatter: 1,
        rotationDamp: 0.12,
        duration: 0.18,
      }, 1.24)
      .to(visualStage, {
        y: () => lateFieldYOffset() * 0.72,
        duration: 0.18,
      }, 1.24)
      .to(storyMotionRef.current, {
        mapProgress: 0.28,
        rotationDamp: 0.08,
        duration: 0.1,
      }, 1.42)
      .to(visualStage, {
        y: () => lateFieldYOffset() + finalMapOpticalYOffset(),
        duration: 0.26,
      }, 1.42)
      .to(storyMotionRef.current, {
        mapProgress: 0.78,
        rotationDamp: 0.055,
        expansion: mapAssemblyExpansion,
        duration: 0.16,
      }, 1.5)
      .to(storyMotionRef.current, {
        mapProgress: 0.95,
        rotationDamp: 0.025,
        expansion: () => (mapAssemblyExpansion() + finalMapExpansion()) / 2,
        duration: 0.14,
      }, 1.62)
      .to(storyMotionRef.current, {
        mapProgress: 1,
        rotationDamp: 0,
        expansion: finalMapExpansion,
        mapPresence: 1,
        duration: 0.16,
      }, 1.74)
      .to({}, { duration: 0.001 }, 1.9);

    const fragmentTimings: Record<string, number> = {
      "input-activities": 0.52,
      "input-accessibility": 0.54,
      "input-food": 0.56,
      "input-pace": 0.58,
      "input-dates": 0.6,
      "input-budget": 0.62,
      "plan-row-0": 0.55,
      "plan-row-1": 0.57,
      "plan-row-2": 0.59,
      "plan-row-3": 0.61,
      "plan-row-4": 0.62,
      "travel-token": 0.62,
      "shared-plan-card": 0.64,
    };

    Object.entries(fragmentTimings).forEach(([source, start]) => {
      const selector = `.fragment-source-${source}`;
      scrollTl
        .fromTo(selector, {
          autoAlpha: 0,
          x: (_index, target) => fragmentPoint(target as HTMLElement, "start").x,
          y: (_index, target) => fragmentPoint(target as HTMLElement, "start").y,
          scale: 0.72,
          rotation: (_index, target) => (Number.parseFloat((target as HTMLElement).style.getPropertyValue("--fb")) || 0) * 18,
        }, {
          autoAlpha: 0.72,
          x: (_index, target) => fragmentPoint(target as HTMLElement, "release").x,
          y: (_index, target) => fragmentPoint(target as HTMLElement, "release").y,
          scale: 0.96,
          duration: 0.04,
          stagger: { each: 0.003, from: "start" },
          immediateRender: false,
        }, start)
        .to(selector, {
          x: (_index, target) => fragmentPoint(target as HTMLElement, "control").x,
          y: (_index, target) => fragmentPoint(target as HTMLElement, "control").y,
          autoAlpha: 0.58,
          scale: 0.78,
          duration: 0.05,
          stagger: { each: 0.003, from: "start" },
        }, start + 0.04)
        .to(selector, {
          x: (_index, target) => fragmentPoint(target as HTMLElement, "target").x,
          y: (_index, target) => fragmentPoint(target as HTMLElement, "target").y,
          autoAlpha: 0,
          scale: 0.22,
          duration: 0.06,
          stagger: { each: 0.003, from: "start" },
        }, start + 0.09);
    });

    scrollTl.to(".absorption-fragment", { autoAlpha: 0, duration: 0.03 }, 0.82);

    gsap.delayedCall(0.05, () => ScrollTrigger.refresh());
  }, { scope: heroRef });

  return (
    <section className="hero shell" ref={heroRef}>
      <div className="hero-copy">
        <p className="eyebrow">Group travel, decided together</p>
        <h1>Plan a trip everyone can agree on.</h1>
      </div>
      <div className="hero-scene" aria-label="Many traveler voices gather into one shared plan">
        <HeroInputCluster />
        <BrandConstellation anchorRef={sphereAnchorRef} />
        <HeroSharedPlan />
        <HeroAbsorptionLayer />
      </div>
      <div className="hero-actions">
        <div className="actions">
          <Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link>
          <Link className="button ghost" href="/how-it-works">See how it works</Link>
        </div>
        <p className="fineprint">Free to use &middot; No credit card required</p>
      </div>
    </section>
  );
}
