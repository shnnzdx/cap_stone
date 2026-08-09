"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import HeroStory from "./HeroStory";
import IdeaSphereCanvas, { type IdeaSphereStoryMotion } from "./IdeaSphereCanvas";
import ProductPrinciples from "./ProductPrinciples";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type RestingAnchorGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function HomeIntroSequence() {
  const introRef = useRef<HTMLDivElement | null>(null);
  const visualLayerRef = useRef<HTMLDivElement | null>(null);
  const sphereAnchorRef = useRef<HTMLDivElement | null>(null);
  const visualStageRef = useRef<HTMLDivElement | null>(null);
  const restingAnchorGeometryRef = useRef<RestingAnchorGeometry | null>(null);
  const visualMotionRef = useRef<IdeaSphereStoryMotion>({
    expansion: 1,
    absorption: 0,
    rotationDamp: 1,
    shatter: 0,
    mapProgress: 0,
    mapPresence: 1,
    principleFocusX: 0,
    principleFocusY: 0,
    principleFocusStrength: 0,
  });

  useGSAP(() => {
    const intro = introRef.current;
    const visualLayer = visualLayerRef.current;
    const anchor = sphereAnchorRef.current;
    const visualStage = visualStageRef.current;
    if (!intro || !visualLayer || !anchor || !visualStage) return;

    const writeStageGeometry = (geometry: RestingAnchorGeometry) => {
      visualStage.style.setProperty("--intro-stage-left", `${geometry.left}px`);
      visualStage.style.setProperty("--intro-stage-top", `${geometry.top}px`);
      visualStage.style.setProperty("--intro-stage-width", `${geometry.width}px`);
      visualStage.style.setProperty("--intro-stage-height", `${geometry.height}px`);
    };
    const captureRestingAnchor = () => {
      const rect = anchor.getBoundingClientRect();
      const geometry = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      restingAnchorGeometryRef.current = geometry;
      writeStageGeometry(geometry);
    };
    const syncAnchorSizeIfSafe = () => {
      const geometry = restingAnchorGeometryRef.current;
      if (!geometry) {
        captureRestingAnchor();
        return;
      }

      visualStage.style.setProperty("--intro-stage-width", `${geometry.width}px`);
      visualStage.style.setProperty("--intro-stage-height", `${geometry.height}px`);
    };
    const recaptureRestingAnchorIfAtTop = () => {
      if (window.scrollY <= 2) {
        captureRestingAnchor();
      } else {
        syncAnchorSizeIfSafe();
      }
      requestAnimationFrame(stabilizeProductMapPosition);
    };
    const viewportCenteredY = () => {
      const baseline = restingAnchorGeometryRef.current;
      const rect = visualStage.getBoundingClientRect();
      const currentY = Number(gsap.getProperty(visualStage, "y")) || 0;
      const baseTop = baseline?.top ?? rect.top - currentY;
      const baseHeight = baseline?.height ?? rect.height;
      const opticalOffset = window.innerWidth < 900 ? window.innerHeight * 0.006 : window.innerHeight * 0.008;
      const targetY = window.innerHeight / 2 - (baseTop + baseHeight / 2);
      const upwardLimit = window.innerWidth < 900 ? window.innerHeight * 0.36 : window.innerHeight * 0.34;
      const downwardLimit = window.innerWidth < 900 ? window.innerHeight * 0.2 : window.innerHeight * 0.18;

      return gsap.utils.clamp(-upwardLimit, downwardLimit, targetY) + opticalOffset;
    };
    const stabilizeProductMapPosition = () => {
      if (!intro.classList.contains("is-product-core-active")) return;
      gsap.set(visualStage, { y: viewportCenteredY() });
    };
    const showVisualLayer = () => {
      gsap.set(visualLayer, { autoAlpha: 1 });
    };
    const hideVisualLayer = () => {
      gsap.set(visualLayer, { autoAlpha: 0 });
    };
    let openingFollowFrame = 0;
    const updateOpeningAnchorFollow = () => {
      const baseline = restingAnchorGeometryRef.current;
      if (!baseline) return;
      if (
        intro.classList.contains("is-field-recentering") ||
        intro.classList.contains("is-product-core-active")
      ) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      gsap.set(visualStage, { y: rect.top - baseline.top });
    };
    const requestOpeningAnchorFollow = () => {
      cancelAnimationFrame(openingFollowFrame);
      openingFollowFrame = requestAnimationFrame(updateOpeningAnchorFollow);
    };

    captureRestingAnchor();
    const resizeObserver = new ResizeObserver(recaptureRestingAnchorIfAtTop);
    resizeObserver.observe(anchor);
    window.addEventListener("resize", recaptureRestingAnchorIfAtTop);
    window.addEventListener("scroll", requestOpeningAnchorFollow, { passive: true });
    ScrollTrigger.addEventListener("refresh", requestOpeningAnchorFollow);
    ScrollTrigger.addEventListener("refresh", stabilizeProductMapPosition);
    gsap.set(visualLayer, { autoAlpha: 1 });
    const refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());

    const product = intro.querySelector<HTMLElement>(".product-overview");
    let productLifecycleFrame = 0;
    const updateProductVisualLifecycle = () => {
      if (!product) return;

      const rect = product.getBoundingClientRect();
      const progress = gsap.utils.clamp(0, 1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height));

      if (rect.bottom <= 0) {
        hideVisualLayer();
        intro.classList.remove("is-product-core-active");
        return;
      }

      const exitProgress = gsap.utils.clamp(0, 1, (progress - 0.78) / 0.22);
      gsap.set(visualLayer, { autoAlpha: 1 - exitProgress });
      intro.classList.toggle("is-product-core-active", progress > 0.02 && progress < 0.98);
    };
    const requestProductLifecycleUpdate = () => {
      cancelAnimationFrame(productLifecycleFrame);
      productLifecycleFrame = requestAnimationFrame(updateProductVisualLifecycle);
    };

    if (product) {
      window.addEventListener("scroll", requestProductLifecycleUpdate, { passive: true });
      window.addEventListener("resize", requestProductLifecycleUpdate);
      ScrollTrigger.addEventListener("refresh", requestProductLifecycleUpdate);
      requestProductLifecycleUpdate();
    }

    if (product) {
      const productLifecycle = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: product,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.65,
          invalidateOnRefresh: true,
          refreshPriority: 2,
          onEnter: showVisualLayer,
          onEnterBack: showVisualLayer,
          onLeave: () => {
            hideVisualLayer();
            intro.classList.remove("is-product-core-active");
          },
          onLeaveBack: () => {
            showVisualLayer();
            intro.classList.remove("is-product-core-active");
          },
          onUpdate: (self) => {
            updateProductVisualLifecycle();
          },
        },
      });

      productLifecycle
        .set(visualLayer, { autoAlpha: 1 }, 0)
        .to(visualMotionRef.current, { mapPresence: 0.52, duration: 0.18 }, 0)
        .to(visualMotionRef.current, { mapPresence: 0.52, duration: 0.6 }, 0.18)
        .to(visualMotionRef.current, { mapPresence: 0, duration: 0.22 }, 0.78);
    }

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(refreshFrame);
      cancelAnimationFrame(openingFollowFrame);
      cancelAnimationFrame(productLifecycleFrame);
      window.removeEventListener("scroll", requestOpeningAnchorFollow);
      window.removeEventListener("scroll", requestProductLifecycleUpdate);
      window.removeEventListener("resize", requestProductLifecycleUpdate);
      window.removeEventListener("resize", recaptureRestingAnchorIfAtTop);
      ScrollTrigger.removeEventListener("refresh", requestOpeningAnchorFollow);
      ScrollTrigger.removeEventListener("refresh", stabilizeProductMapPosition);
      ScrollTrigger.removeEventListener("refresh", requestProductLifecycleUpdate);
    };
  }, { scope: introRef });

  return (
    <div className="intro-story" ref={introRef}>
      <div className="intro-visual-layer" ref={visualLayerRef}>
        <div className="intro-visual-sticky">
          <div className="constellation idea-sphere-stage intro-persistent-stage" ref={visualStageRef}>
            <IdeaSphereCanvas storyMotionRef={visualMotionRef} visibilityRootRef={introRef} />
          </div>
        </div>
      </div>

      <HeroStory
        storyMotionRef={visualMotionRef}
        sphereAnchorRef={sphereAnchorRef}
        visualStageRef={visualStageRef}
        restingAnchorGeometryRef={restingAnchorGeometryRef}
      />

      <section className="section product-overview" id="product-overview">
        <div className="shell">
          <ProductPrinciples storyMotionRef={visualMotionRef} />
        </div>
      </section>
    </div>
  );
}
