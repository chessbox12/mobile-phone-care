# Mobile Phone Care — premium one-page site

A clean, minimal single-page site for **Mobile Phone Care**, a Sydney phone &
device repair specialist (Martin Place CBD + DFO Homebush).

The hero is a **real 3D iPhone 15 Pro** that the visitor "repairs" by scrolling:
the cracked screen heals, the phone rotates to the back, the back glass heals,
and it ends polished. Below it: minimal service chips, a one-line warranty, and
the two locations.

## Stack

- Plain `index.html` + `styles.css` + `script.js` (ES module) — no build step
- **[Three.js](https://threejs.org/) r160** (WebGL) for the 3D phone, with
  `GLTFLoader` + `DRACOLoader` and `RoomEnvironment` reflections
- **GSAP ScrollTrigger** (pin + scrub) + **Lenis** smooth scroll
- Crack "heal" = SVG shatter textures overlaid on the model, faded by scroll
- Everything vendored locally in `assets/vendor/` (works offline)
- Clean palette (warm off-white + charcoal); static fallback for no-WebGL /
  `prefers-reduced-motion`

## 3D model attribution

The hero uses **"Apple iPhone 15 Pro Max"** by **Polyman** (Sketchfab),
licensed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.
Model file: `assets/models/iphone15.glb`. Credit is shown in the site footer.

## Run locally

Use the included no-cache dev server (keeps edits fresh while developing):

```bash
python3 scripts/devserver.py 4500 .
# then open http://localhost:4500
```

Any static server works too (e.g. `python3 -m http.server`).

## Structure

```
index.html          # markup + JSON-LD + importmap
styles.css          # clean palette + pinned-canvas stage + sections
script.js           # Three.js scene + GSAP/Lenis scroll choreography
assets/models/      # iphone15.glb (CC BY 4.0)
assets/vendor/      # three, addons (loaders, draco, env), gsap, scrolltrigger, lenis
scripts/devserver.py# no-cache static server for local dev
```

## Deploy

Static — drag onto Netlify / Cloudflare Pages / any static host. The `.glb`,
Draco decoder, and WebP textures must be served as-is (no extra config needed).
