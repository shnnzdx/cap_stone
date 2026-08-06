"use client";

import { useEffect } from "react";

export default function ProductScrollFlow() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".people-problem, .story-frame, .demo-section, .final-cta"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((target) => target.classList.add("product-in-view"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("product-in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: "0px 0px -8% 0px" });
    targets.forEach((target) => { target.classList.add("product-reveal"); observer.observe(target); });
    return () => observer.disconnect();
  }, []);
  return null;
}
