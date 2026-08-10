# Cadensy Homepage Hero and Scroll Storytelling Final Design

**Status:** target design for the next homepage implementation
**Supersedes:** `ai-travel-hero-animation-design-v3.md`
**Scope:** homepage hero, traveler input clusters, living 3D Idea Sphere, scroll absorption, sphere expansion, shatter, point-based world map, and transition into the next section
**Technical baseline:** React / Next.js with native Three.js
**Design language:** pale blue, soft spatial data, collaborative intelligence, editorial travel

Reference boundaries: the design may use the idea of volumetric particle presence and the structure "many inputs -> coordination core -> shared plan." Do not copy another site's exact layout, shader, colors, source behavior, or assets.

---

## 1. Core Story

The homepage opening is not a static three-column layout and not a standalone particle demo. It is a continuous scroll story:

```text
Many independent traveler inputs
  -> coexist around a living 3D Idea Sphere
  -> left-side Inputs and right-side Shared Plan enter with slight stagger
  -> the user scrolls
  -> CTA fades first
  -> side UI compresses, fragments, and is absorbed into the sphere
  -> the sphere grows as it absorbs information
  -> the sphere becomes the visual center
  -> it destabilizes and shatters
  -> particles reassemble into a quiet point-based world map
  -> the next content section begins naturally
```

Product meaning:

> Many voices become one shared direction, and that shared direction opens into a world of possible travel.

---

## 2. Design Goals

The hero must do four things:

1. Show group collaboration. The left side must clearly include multiple members, preferences, limits, and tensions.
2. Establish the 3D Idea Sphere as Cadensy's visual signature. It is the coordination core, not decoration.
3. Show movement from scattered input to ordered shared plan. Left side is looser and more personal; right side is calmer and more structured.
4. Connect the hero and the next section into one visual story. Avoid a hard page cut or a giant white panel.

Suggested design dials:

```text
DESIGN_VARIANCE: 8
MOTION_INTENSITY: 8
VISUAL_DENSITY: 5
```

Interpretation:

- Scene 1 can be asymmetric.
- Left and right sides should not mirror each other.
- Cards can float and stagger slightly.
- Motion is restrained in Scene 1 and stronger during absorption, expansion, shatter, and map assembly.
- The page must keep pale-blue breathing room and must not become a dashboard.

---

## 3. Final Structure

Discard the old structure:

```text
Left sphere -> middle placeholder/processor -> right vertical plan flow
```

Use:

```text
Left Independent Traveler Inputs
  -> center Living 3D Idea Sphere
  -> right Shared Plan
```

Therefore:

- no separate middle placeholder;
- no extra AI brain, crystal, or processor visual;
- no large white container;
- the existing sphere is the coordination core.

Overall stages:

```text
A. Natural-flow Hero Scene
B. Scroll Transition Scene
C. World Map / Section 2 bridge
```

The hero is not a fixed `100vh` box. It may extend beyond the first viewport. The CTA may sit slightly below the fold on short screens.

---

## 4. Scene 1: Natural-Flow Hero

Layout:

```text
Hero heading

Left Input Cluster
        -> Living 3D Idea Sphere
Right Shared Plan

CTA
Fine print
```

Scene 1 requirements:

- The H1 is real HTML text and remains readable.
- The sphere is the primary visual asset.
- The left cluster contains multiple distinct people and needs.
- The right shared plan looks more ordered than the left cluster.
- The composition has visible asymmetry and editorial spacing.
- The CTA is accessible and not absorbed into the visual too early.

Do not:

- create three equal dashboard columns;
- place everything inside a large white card;
- make every left card identical;
- hide the product meaning behind pure animation.

---

## 5. Left Input Cluster

The left side represents independent traveler inputs before coordination.

Use 5-7 small cards or chips. They should vary in size, content, position, and emphasis.

Example input types:

- budget ceiling;
- no early mornings;
- vegetarian meals;
- museum interest;
- walking limit;
- date availability;
- hotel preference.

Visual behavior:

- cards float with small vertical offsets;
- a few cards can be partially closer to the sphere;
- some cards can feel unresolved or competing;
- content should be short and legible.

Avoid:

- equal feature cards;
- generic "user 1 / user 2 / user 3" labels only;
- turning private preferences into exposed named details.

---

## 6. Center Idea Sphere

The existing 3D Idea Sphere is the coordination core.

Meaning:

- every particle is an idea, constraint, preference, or concern;
- the sphere is not the final plan;
- the sphere is the living group problem space before Cadensy resolves it.

Rendering principles:

- keep native Three.js;
- use `THREE.Points` and shader-based particles;
- do not create React elements per particle;
- keep pointer, frame, and animation values outside React state;
- cap DPR for performance;
- pause rendering when the canvas is offscreen.

Visual principles:

- pale blue point language;
- visible depth;
- calm but alive motion;
- no cyberpunk, portal, blockchain, AI brain, or planet reading.

---

## 7. Right Shared Plan

The right side shows the output of coordination: one calmer plan.

It should include:

- trip name;
- readiness state;
- itinerary card or day summary;
- safe privacy summary;
- one decision or adjustment state.

Example:

```text
Chicago Weekend
Shared Plan

5 of 6 ready
Budget stays within confirmed limits
One time requirement affects Friday morning
Dinner slot needs confirmation
```

The right side must look more structured than the left, but still lightweight and editorial. It should not become a dense application dashboard.

---

## 8. Scroll Transition

The transition begins after the visitor understands Scene 1.

Order:

1. CTA and fine print fade first.
2. Heading exits without being absorbed.
3. Left input cards compress.
4. Right shared-plan elements compress in a more ordered way.
5. Cards fragment into controlled particles.
6. Fragments move along curved paths toward the sphere.
7. The sphere reacts to each absorption.
8. The sphere expands and becomes the main visual center.

The absorption should feel like information being integrated, not a black hole or aggressive vortex.

Do not:

- pull every element at the same time;
- use long neon trails;
- absorb the CTA;
- shatter heading text;
- make all fragments explode radially.

---

## 9. Fragmentation Rules

"Card fragmentation" does not mean breaking every DOM node into hundreds of live elements.

Recommended implementation:

- Use a limited fragment pool.
- Split only the main card surfaces, lines, and emphasis chips.
- Use canvas or shader-driven fragments when possible.
- Keep text readable before transition; during transition, text can dissolve into shape fragments.
- Do not animate thousands of DOM particles with GSAP.

Each major card can break into:

- background tile fragments;
- line fragments;
- small dot fragments;
- one or two accent chips.

The result should be readable as decomposition without being expensive.

---

## 10. Sphere Expansion

After absorption begins, the sphere should physically scale and become the dominant object.

Requirements:

- scale the sphere, not only particle size;
- keep motion smooth and restrained;
- preserve depth in the center;
- avoid heavy bloom;
- keep the pale-blue palette;
- the sphere should feel like it gained mass from the absorbed inputs.

---

## 11. Shatter

The shatter is a directional deconstruction, not fireworks.

Requirements:

- sphere constraints gradually loosen;
- particles move into a wider horizontal field;
- timing is staggered, not simultaneous;
- no shockwave, black hole, portal, or radial explosion;
- the motion remains elegant and readable.

The shatter prepares the world map. It should feel like the same information is reorganizing, not like the old scene was destroyed randomly.

---

## 12. World Map

The world map is point-based and inherits the sphere language.

Requirements:

- continents are recognizable;
- no borders;
- no country labels;
- no GIS dashboard treatment;
- no click interaction required;
- map forms progressively from the shatter particles;
- resting map is quiet enough to support the next section.

The map is a bridge to the next story: after group voices become one direction, the product opens into possible travel.

---

## 13. Section 2 Bridge

The hero should release naturally into the next section.

Requirements:

- no obvious boxed ending;
- background continuity;
- map becomes a visual anchor for the next section;
- Section 2 HTML remains independently readable;
- the user still feels they are in one continuous Cadensy story.

---

## 14. Accessibility

Must preserve:

- real HTML H1;
- real CTA;
- readable supporting copy;
- canvas as supporting visual, not the only information channel;
- keyboard access for links and buttons;
- no required interaction that depends only on WebGL hover.

Reduced motion:

- Scene 1 remains mostly static with ambient sphere motion;
- absorption can become a fade/scale transition;
- shatter can become a crossfade into the point map.

---

## 15. Mobile Behavior

Mobile should not compress the desktop three-part composition into tiny columns.

Recommended order:

```text
Heading
Sphere
Input highlights
Shared Plan preview
CTA
```

Mobile behavior:

- reduce particle count;
- disable pointer parallax;
- lower fragment count;
- use tap only for essential interactions;
- keep text readable without overlap.

---

## 16. Performance Boundaries

Requirements:

- Pause canvas animation when offscreen.
- Cap device pixel ratio.
- Reduce particle count on low-performance devices.
- Use typed arrays, shaders, or canvas for large particle motion.
- Do not create thousands of React components for particles.
- Do not update React state every frame.

State should only track coarse scene phase, active hover target, and reduced-motion preference.

---

## 17. Suggested Component Split

Current sphere implementation can remain intact for the first implementation.

Possible future structure:

```text
HeroStory
  HeroHeading
  TravelerInputCluster
  IdeaSphereCanvas
  SharedPlanPreview
  ScrollTransitionController
  PointWorldMap
```

Do not migrate files just for architecture. Split when transition complexity requires it.

---

## 18. GSAP Boundary

GSAP may control scroll-triggered DOM timelines:

- entrance;
- CTA fade;
- card compression;
- small pooled fragment movement;
- section release.

Three.js should control:

- sphere particle motion;
- absorption response;
- sphere scale;
- shatter field;
- point-map reassembly.

Avoid GSAP tweening thousands of particles.

---

## 19. Do Not Add

Do not add:

- full booking search;
- price cards;
- hotel marketplace UI;
- generic AI chat hero;
- dark cyberpunk visuals;
- planet/Earth interpretation;
- large bento panels;
- feature-card grid as the hero.

Current target is homepage visual storytelling, not a full marketing site redesign.

---

## 20. Acceptance Checklist

Scene 1:

- [ ] H1 is clear.
- [ ] Left side clearly represents multiple traveler inputs.
- [ ] Left cards are not identical.
- [ ] Sphere is the main visual center.
- [ ] Right side is calmer and more ordered than the left.
- [ ] Layout feels modern and editorial.
- [ ] CTA remains accessible.
- [ ] Mobile is not a tiny desktop layout.

Absorption:

- [ ] CTA fades before transition.
- [ ] Heading exits but is not absorbed.
- [ ] Left cards compress, fragment, and move toward the sphere.
- [ ] Right plan decomposes in a more ordered way.
- [ ] Fragment count is controlled.
- [ ] Pull paths have curves.
- [ ] No black-hole effect or long neon trails.
- [ ] Sphere visibly responds to absorption.

Expansion:

- [ ] Sphere genuinely scales up.
- [ ] Motion does not suddenly accelerate.
- [ ] Center keeps spatial depth.
- [ ] No heavy bloom.

Shatter:

- [ ] Directional deconstruction, not fireworks.
- [ ] Particles do not explode in one synchronized burst.
- [ ] Palette stays pale blue.
- [ ] No shockwave, portal, or black hole.

World map:

- [ ] Map uses the same point language.
- [ ] Continents are recognizable.
- [ ] No borders or country names.
- [ ] Map forms progressively.
- [ ] Resting map is quiet.

Final judgment:

1. Does the first view clearly communicate group travel planning?
2. Does the left side feel like many different voices?
3. Is the sphere still the hero's visual core?
4. Is the right side visibly more ordered?
5. Does the experience avoid looking like a generic SaaS grid?
6. Does the scroll transition feel like integration rather than decoration?
7. Does the map feel like the same particles reorganized?
8. Does the whole experience feel specific to Cadensy?

If the answer to the last question is no, the design is not finished.
