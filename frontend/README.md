# TripSync Frontend Shell

This app owns the public-facing site and the embedded Trip workspace shell.

The active application database is not inside this frontend package. TripSync
uses the FastAPI backend in `../backend`, and that backend persists data in
PostgreSQL through SQLAlchemy.

## What This App Does

- serves the landing/product pages under `frontend/app`
- hosts the `/trip` shell that embeds the built Trip workspace
- stores copied Trip workspace assets under `frontend/public/trip-app`
- shares visual and route contracts with `../trip` through `../shared`

## What This App Does Not Do

- it does not own database tables
- it does not use Cloudflare D1 for the current capstone backend
- it does not use Drizzle migrations
- it does not use a local SQLite database for application data

The old D1/Drizzle starter files were removed to keep the project database story
clear for the Module 7 full-stack integration milestone.

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the frontend build
- `npm run build:trip-preview`: build `../trip` and copy it into `public/trip-app`
- `npm run sync:trip-preview`: copy an already-built `../trip/dist`
- `npm test`: build and run frontend verification tests

For database setup, seed data, SQL checks, and the video demo flow, see
`../backend/DATABASE_GUIDE.md`.
