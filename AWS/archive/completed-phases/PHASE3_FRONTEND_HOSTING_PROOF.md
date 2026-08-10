# AWS Phase 3 - Frontend Hosting Proof

Status: local proof implemented; no AWS resources created.

## Scope

Phase 3 answers one question:

```text
Can the current frontend be hosted as a simple static site, or does it need SSR compute hosting?
```

This phase does not create Amplify apps, S3 buckets, CloudFront distributions, IAM roles, or any other AWS resources.

## Current Frontend Shape

The main frontend is under:

```text
frontend/
```

The embedded Trip app remains under:

```text
trip/
frontend/public/trip-app/
```

The frontend build uses:

```text
vinext build
```

The relevant package signals are:

```text
vinext
Next.js 16.x
Node.js >=22.13.0
```

## Proof Result

The current build emits both:

```text
frontend/dist/client
frontend/dist/server
```

`frontend/dist/client` contains the embedded Trip static page:

```text
trip-app/index.html
```

But the main app routes are not emitted as static HTML files such as:

```text
index.html
login/index.html
product/index.html
how-it-works/index.html
trip/index.html
```

Therefore, the current frontend should not be treated as a pure static S3/CloudFront site.

## AWS Hosting Implication

Amplify Hosting managed SSR should not be assumed ready for this app because AWS documentation currently states managed Next.js SSR support for Next.js 12 through 15, while this app uses Next.js 16.x through Vinext.

Before creating an Amplify app, prove one of these paths:

```text
Option A: Confirm an Amplify-compatible adapter/output for Vinext + Next.js 16.
Option B: Convert the frontend to a static export shape if product requirements allow it.
Option C: Host the frontend SSR runtime as a container later, alongside the backend architecture.
```

For this repository, Option A or C is safer than assuming static hosting.

## Validation Commands

Local:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\frontend
npm run build:trip-preview
npm run build
npm run hosting:proof
```

GitHub Actions:

```text
Frontend Hosting Proof
```

This workflow is manually triggered and validation-only.

## Current Recommendation

Do not create AWS frontend hosting resources yet.

Next recommended step:

```text
Run the Frontend Hosting Proof workflow in GitHub Actions.
If it matches local output, choose between Amplify SSR adapter proof and containerized frontend runtime proof.
```
