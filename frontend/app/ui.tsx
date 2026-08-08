"use client";

import { useState, type CSSProperties, type MutableRefObject } from "react";
import IdeaSphereCanvas, { type IdeaSphereStoryMotion } from "./IdeaSphereCanvas";

const heroInputs = [
  {
    className: "input-budget",
    level: "primary",
    person: "Maya",
    marker: "Budget",
    text: "Keep it under $2,000",
    initials: "M",
  },
  {
    className: "input-dates",
    level: "secondary",
    person: "Tom",
    marker: "Dates",
    text: "June 10-18 works best",
    initials: "T",
  },
  {
    className: "input-pace",
    level: "secondary",
    person: "Lena",
    marker: "Pace",
    text: "Moderate, not too rushed",
    initials: "L",
  },
  {
    className: "input-food",
    level: "micro",
    person: "Arjun",
    marker: "Food",
    text: "Vegetarian options",
    initials: "A",
  },
  {
    className: "input-accessibility",
    level: "secondary",
    person: "Nora",
    marker: "Accessibility",
    text: "Step-free access",
    initials: "N",
  },
  {
    className: "input-activities",
    level: "micro",
    person: "Ethan",
    marker: "Activities",
    text: "Culture + nature",
    initials: "E",
  },
];

const planRows = [
  ["Overview", "Seville, Spain / Jun 10-18"],
  ["Itinerary", "8 days / Balanced pace"],
  ["Budget", "$1,920 per person"],
  ["Travel & Stay", "Flights / Boutique hotels"],
  ["Activities", "Food tours, day trips & more"],
];

const absorptionSources = [
  ["input-activities", 5],
  ["input-accessibility", 7],
  ["input-food", 5],
  ["input-pace", 7],
  ["input-dates", 7],
  ["input-budget", 9],
  ["plan-row-0", 2],
  ["plan-row-1", 2],
  ["plan-row-2", 2],
  ["plan-row-3", 2],
  ["plan-row-4", 2],
  ["travel-token", 4],
  ["shared-plan-card", 6],
] as const;

const fragmentShapes = ["dot", "chip", "strip", "square", "edge"] as const;

const absorptionFragments = absorptionSources.flatMap(([source, count], sourceIndex) =>
  Array.from({ length: count }, (_, index) => {
    const seed = (sourceIndex + 1) * 97 + index * 31;
    const rx = ((seed * 37) % 100) / 100;
    const ry = ((seed * 53) % 100) / 100;
    const size = 0.74 + (((seed * 19) % 32) / 100);
    const bend = (((seed * 23) % 100) - 50) / 50;
    return {
      id: `${source}-${index}`,
      source,
      shape: fragmentShapes[(seed + index) % fragmentShapes.length],
      style: {
        "--fx": rx.toFixed(2),
        "--fy": ry.toFixed(2),
        "--fs": size.toFixed(2),
        "--fb": bend.toFixed(2),
      } as CSSProperties,
    };
  }),
);

export function HeroInputCluster() {
  return (
    <div className="hero-input-cluster" aria-label="Traveler preferences">
      <div className="voice-cluster-label">
        <span>Traveler inputs</span>
        <p>6 individual preferences</p>
      </div>
      <div className="voice-stream">
        <div className="voice-collector" aria-hidden="true" />
        {heroInputs.map((input) => (
          <article className={`voice-item voice-item--${input.level} ${input.className}`} key={input.person}>
            <span className="voice-dot">{input.initials}</span>
            <div className="voice-body">
              <div className="voice-meta">
                <strong>{input.person}</strong>
                <span>{input.marker}</span>
              </div>
              <p>{input.text}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="voice-handoff" aria-hidden="true">
        <span />
        <i />
      </div>
    </div>
  );
}

type BrandConstellationProps = {
  storyMotionRef?: MutableRefObject<IdeaSphereStoryMotion>;
};

export function BrandConstellation({ storyMotionRef }: BrandConstellationProps) {
  return (
    <div
      className="constellation idea-sphere-stage"
      aria-label="Different traveler ideas gather into one shared planning space"
    >
      <IdeaSphereCanvas storyMotionRef={storyMotionRef} />
    </div>
  );
}

export function HeroAbsorptionLayer() {
  return (
    <div className="hero-absorption-layer" aria-hidden="true">
      {absorptionFragments.map((fragment) => (
        <i
          className={`absorption-fragment absorption-fragment--${fragment.shape} fragment-source-${fragment.source}`}
          data-source={fragment.source}
          key={fragment.id}
          style={fragment.style}
        />
      ))}
    </div>
  );
}

export function HeroSharedPlan() {
  return (
    <div className="hero-plan-group" aria-label="Shared plan preview">
      <aside className="travel-token" aria-label="Travel dates">
        <span>SEV</span>
        <b>to</b>
        <span>BCN</span>
        <small>Jun 10 / Jun 18</small>
      </aside>
      <article className="shared-plan-card">
        <p className="plan-kicker">Shared plan</p>
        <h2>Everyone aligned</h2>
        <div className="plan-rows">
          {planRows.map(([label, value], index) => (
            <div className={`plan-row plan-row-${index}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export function DemoPanel() {
  const [active, setActive] = useState(false);
  return <div className={`demo-panel ${active ? "is-active" : ""}`}>
    <div className="demo-copy">
      <span>CONCEPT DEMO</span>
      <h3>{active ? "One focused direction." : "Several priorities, one place to begin."}</h3>
      <p>{active ? "The example highlights how product principles can be presented together without showing a finished itinerary." : "Use this interaction as a temporary preview until the real product screens are ready."}</p>
      <button className="button dark" onClick={() => setActive(!active)}>{active ? "Reset example" : "Bring the ideas together"}</button>
    </div>
    <div className="demo-placeholder" role="img" aria-label="Placeholder for interactive product preview">
      <span>INTERACTIVE PLACEHOLDER</span>
      <strong>{active ? "Future product interface preview" : "Homepage product concept visual"}</strong>
      <small>{active ? "Replace with real UI screenshots when available" : "Animated nodes / brand highlight composition"}</small>
      <div className="mini-nodes"><i/><i/><i/><i/></div>
    </div>
  </div>;
}
