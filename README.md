# Capstone Frontend

This repository contains the current frontend workspace for the capstone project.

## Project Structure

- `frontend/`: the main product site built with Next/Vinext
- `trip/`: the TripSync workspace app
- `frontend/public/trip-app/`: the built static TripSync app used inside `/trip`
- `docs/`: project documents and notes

## Prerequisites

- Node.js `>= 22.13.0`
- npm

## Install Dependencies

From the repository root:

```bash
cd frontend
npm install
```

If you also need to rebuild the embedded TripSync app:

```bash
cd ../trip
npm install
npm run build
cd ../frontend
```

Copy the TripSync build output into the main frontend:

On PowerShell:

```powershell
Copy-Item -Path ../trip/dist/* -Destination ./public/trip-app -Recurse -Force
```

On macOS/Linux:

```bash
cp -R ../trip/dist/* ./public/trip-app/
```

## Run the Frontend

From `frontend/`:

```bash
npm run dev
```

The frontend should then be available at:

```text
http://localhost:3000
```

## Main Routes

- `/`: landing page
- `/login`: login page
- `/signup`: signup page
- `/how-it-works`: product workflow page
- `/faq`: FAQ page
- `/privacy`: privacy page
- `/trip`: embedded TripSync preview
- `/trip-app/`: direct static TripSync entry

## Custom Port

If port `3000` is already in use:

```bash
node scripts/run-vinext.mjs dev --port 3001
```

## Build for Verification

```bash
npm run build
```

## Notes

- The `frontend` and `trip` apps are not fully merged into a single codebase.
- The `/trip` route currently loads the built TripSync app from `frontend/public/trip-app/`.
- The frontend scripts are cross-platform and work on Windows, macOS, and Linux.
