"use client";

import { useState } from "react";
import IdeaSphereCanvas from "./IdeaSphereCanvas";

export function BrandConstellation() {
  return (
    <div
      className="constellation idea-sphere-stage"
      aria-label="Different traveler ideas gather into one shared planning space"
    >
      <IdeaSphereCanvas />
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
