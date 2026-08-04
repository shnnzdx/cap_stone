# Security Data Pipeline Animation

A dependency-free SVG/CSS/JavaScript recreation of the animated pipeline diagram shown in the provided Monad homepage reference.

## Run locally

Open `index.html` directly in a browser, or start a tiny local server:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Main customization points

- Change source and destination labels inside `index.html`.
- Adjust connector curves through the SVG paths named `input-path-*` and `output-path-*`.
- Change packet speed, type, labels and delay in the `packetSpecs` array in `script.js`.
- Change colors and sizing through the CSS variables at the top of `styles.css`.

## Implementation notes

- No external libraries or downloaded site assets are used.
- The diagram scales through a single SVG `viewBox`.
- Moving packets use `getPointAtLength()` so they follow curved SVG paths accurately.
- A pause/resume control and `prefers-reduced-motion` behavior are included.
