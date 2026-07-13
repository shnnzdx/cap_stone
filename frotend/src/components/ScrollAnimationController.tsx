import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ScrollAnimationControllerProps = {
  heroRef: RefObject<HTMLElement>;
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
};

export function ScrollAnimationController({
  heroRef,
  progressRef,
  reducedMotion,
}: ScrollAnimationControllerProps) {
  useEffect(() => {
    if (reducedMotion) {
      progressRef.current = 0;
      return undefined;
    }

    gsap.registerPlugin(ScrollTrigger);
    const trigger = heroRef.current;
    if (!trigger) return undefined;

    const tween = gsap.to(progressRef, {
      current: 1,
      ease: "none",
      scrollTrigger: {
        trigger,
        start: "top top",
        end: "bottom top",
        scrub: 0.85,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      progressRef.current = 0;
    };
  }, [heroRef, progressRef, reducedMotion]);

  return null;
}
