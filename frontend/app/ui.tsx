"use client";

import { useState } from "react";

const ideaParticles = Array.from({ length: 28 }, (_, index) => ({
  left: 18 + ((index * 37) % 64), top: 14 + ((index * 53) % 70),
  size: 3 + (index % 4), delay: -((index % 9) * .37),
}));

export function BrandConstellation() {
  return <div className="constellation pipeline-hero" aria-label="Different traveler ideas are organized into one clear, verifiable plan">
    <div className="placeholder-label"><span>FROM MANY VOICES TO ONE PLAN</span><small>Private input → coordinated decisions</small></div>
    <div className="pipeline-zone idea-zone" aria-hidden="true">
      <div className="idea-orb">{ideaParticles.map((particle, index) => <i key={index} style={{left:`${particle.left}%`,top:`${particle.top}%`,width:particle.size,height:particle.size,animationDelay:`${particle.delay}s`}} />)}</div>
      <span className="idea-tag tag-budget">Budget</span><span className="idea-tag tag-dates">Dates</span><span className="idea-tag tag-pace">Pace</span>
      <strong>Group input</strong>
    </div>
    <div className="pipeline-route route-in" aria-hidden="true"><i/><i/><i/></div>
    <div className="pipeline-processor" aria-hidden="true"><span className="brand-mark large">T</span><b>Understand</b><b>Validate</b></div>
    <div className="pipeline-route route-out" aria-hidden="true"><i/><i/><i/></div>
    <div className="plan-zone" aria-hidden="true"><strong>Shared plan</strong><ol><li>Create</li><li>Share</li><li>Review</li><li>Confirm</li></ol></div>
    <p className="pipeline-caption">Every voice stays distinct.<br/>The plan becomes clear.</p>
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
