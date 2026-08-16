# Map Day Tabs And Stability Notes

## Problem

The Plan map day tabs could display but became unreliable to click.

Symptoms included:

- `All / Day 1 / Day 2 / Day 3 / Day 4` visually rendered
- day buttons sometimes did not receive pointer events
- clicking a day could destabilize the map area
- `/trip` could appear as a blank warm-paper page after interaction regressions

## Files Involved

- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/final.css`

## What Changed

### Kept Existing Selection Logic

The existing plan runtime state and handlers are still used:

- `railDay`
- `showAllOnMap`
- `showDayOnMap(day.id)`
- `railDays`

No second selected-day state was introduced.

### Removed Map Remount Key

The map was previously keyed by selected day:

```jsx
<TripMap key={view.railDay} ... />
```

That forced the Leaflet map to remount when changing tabs.

The key was removed so the existing map instance can update through props instead of being destroyed and recreated on every tab click.

### Protected Tab Click Targets

CSS was added so the map tab row stays above Leaflet/map layers:

- `position: relative`
- higher `z-index`
- `isolation: isolate`
- explicit `pointer-events: auto`
- pointer cursor on buttons

This keeps the visual tab controls clickable without rewriting the map component.

### Preserved Marker Interaction

CSS was also added to keep Leaflet marker icons interactive:

- marker pointer events remain enabled
- marker cursor remains pointer
- marker z-index stays above map overlays

## What Was Not Changed

No changes were made to:

- map data
- POI data
- TripMap component logic
- map library
- backend route data
- selected item data structure

## Expected Behavior

Clicking map tabs should:

- set the selected tab visually
- update `railDay`
- filter/focus the map to that day through existing data flow
- keep `All` as the full-trip view
- not blank the page
