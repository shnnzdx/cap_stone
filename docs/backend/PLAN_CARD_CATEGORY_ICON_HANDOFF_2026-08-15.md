# Plan Card Category Icon Handoff

Last updated: 2026-08-15

## 1. Purpose

This document records the Plan page visual handoff for the compact activity and meal card change.

The goal was to remove the old itinerary photo placeholder behavior from Plan cards and replace it with a smaller category-icon layout while keeping the existing PlanFeature architecture boundary intact.

## 2. Current Verdict

The Plan page now uses compact stop cards for sightseeing and meals.

Completed:

- sightseeing cards no longer render `PHOTO`
- sightseeing cards no longer reserve a large rectangular image area
- each stop has a small category icon, about 48px
- meal stops use the same small-icon language with a utensils icon
- Lunch and Dinner remain semantically separate through `item.isMeal` and `item.mealType`
- start time is now a separate right-side primary field
- address is displayed as a lower-priority compact line

Not changed:

- Trip Cover / Unsplash cover behavior
- Place / Activity image data model
- PlanFeature interaction ownership
- Session, Navigation, or workspace routing

## 3. Product Behavior Now True

The visible card hierarchy is now:

```text
[category icon]  Place name                       Start time
                 Category label
                 Short address
```

For meals:

```text
[utensils icon]  Restaurant name                  Start time
                 LUNCH / DINNER
                 Short area/address
```

Meals are still independent plan items and do not participate in sightseeing numbering.
The day header still reads in the existing form:

```text
3 activities · 2 meals
```

## 4. Files Changed

Primary source files:

- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/final.css`

Generated embed output:

- `frontend/public/trip-app/index.html`
- `frontend/public/trip-app/embed-manifest.json`
- `frontend/public/trip-app/assets/*`

Regression test:

- `frontend/tests/trip-preview-integration.test.mjs`

## 5. Implementation Details

### 5.1 Category mapping

The mapping intentionally stays small and display-focused.

Current presentation helper:

```text
Museum        -> museum / column icon
Park Garden   -> leaf icon
Historic      -> landmark icon
Art Gallery   -> gallery icon
Aquarium      -> wave icon
Waterfront    -> wave icon with Attraction label
Attraction    -> landmark icon
Unknown       -> map pin icon
Meal          -> utensils icon
```

This does not try to cover every Geoapify category. It only gives a stable visual language for the common trip-planning categories.

### 5.2 Icon implementation

No new icon dependency was added.

`trip` currently has no icon package dependency, so the change uses a small inline SVG switch inside `PlanFeature.jsx` rather than adding a package or broader UI library.

### 5.3 Address display

The database address remains unchanged.

Only frontend display uses the existing `compactAddress(...)` helper. This keeps the stored provider facts intact while making cards easier to scan.

### 5.4 Time display

The start time is now rendered as its own `<time className="activityStartTime">` element.

This replaces the older pattern where address and time were combined in one metadata line.

## 6. Validation Record

Commands run:

```bash
cd trip
npm run build
```

Result: passed.

```bash
cd frontend
npm run build:trip-preview
```

Result: passed and regenerated the embedded Trip app.

```bash
node --test frontend/tests/trip-preview-integration.test.mjs
```

Result: 9 passed.

The integration test now includes a guard that Plan cards use compact category icons and do not reintroduce `ActivityPhoto`, `activityPhoto`, or `PHOTO` text.

## 7. Known Boundaries

- The old CSS bundle still contains unrelated historical dashboard photo classes in some built output. Those are not Plan activity cards.
- The Plan page intentionally does not use Trip Cover images for activities or meals.
- The map markers and Plan selection/comment behavior remain owned by the existing PlanFeature runtime.

