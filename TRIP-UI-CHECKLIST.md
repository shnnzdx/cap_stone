# Trip UI Change Checklist

Use this checklist whenever you change Trip workspace UI under `trip/src/...`.

## Why This Exists

Two different issues can make a valid UI change look like it "did not work":

1. The source code changed, but the embedded `/trip` preview still uses an older built bundle.
2. A later high-specificity CSS override flattens interactive states like `.open` or `.active`, so the React state changes but the UI looks unchanged.

## Required Steps After Trip UI Changes

1. Update the source files under `trip/src/...`.
2. Rebuild the embedded preview bundle:

```powershell
cd frontend
npm run build:trip-preview
```

3. Check any new CSS override carefully.

Make sure it does not collapse:

- default state and `.open`
- default state and `.active`
- closed and expanded accordion states
- unselected and selected tab/button states

## Quick Verification

After the preview rebuild:

1. Confirm `frontend/public/trip-app/index.html` points to the newest hashed assets.
2. Run the Trip preview integration checks:

```powershell
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

3. Hard refresh the browser if `/trip` still appears stale.

## Current Regression Coverage

The current test suite includes coverage for:

- preview bundle sync
- Plan accordion open/closed CSS state preservation
- Trip preview shell integration
