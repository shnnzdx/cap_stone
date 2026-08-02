"use client";

import { useState } from "react";

const values = ["Private", "Budget-aware", "Collaborative", "Considered", "Adaptive", "Shared"];

export function BrandConstellation() {
  return <div className="constellation" aria-label="TripSync brand animation showing product values coming together">
    <div className="placeholder-label"><span>HERO VISUAL</span><small>Animated product-value constellation → TripSync logo</small></div>
    <div className="orbit-lines" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    {values.map((value, i) => <div key={value} className={`value-node node-${i + 1}`}><b/><span>{value}</span></div>)}
    <div className="constellation-core"><span className="brand-mark large">T</span><strong>TripSync</strong><small>Many perspectives. One shared direction.</small></div>
  </div>;
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
