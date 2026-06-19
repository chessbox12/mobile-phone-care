# Mobile Phone Care — premium one-page site

A cinematic, single-page scrolling website for **Mobile Phone Care**, a Sydney
phone & device repair specialist (Martin Place CBD + DFO Homebush).

Built as a fast, dependency-light **static site** — no build step.

## Stack

- Plain `index.html` + `styles.css` + `script.js`
- [GSAP](https://gsap.com/) + ScrollTrigger and [Lenis](https://lenis.darkroom.engineering/)
  smooth-scroll — **vendored locally** in `assets/vendor/` (works offline, no CDN)
- Hand-built SVG visuals (hero phone, circuit board, icons) in the markup
- Dark cinematic-luxury theme, glassmorphism, scroll-triggered animation
- Mobile-first, responsive, AA-contrast, honours `prefers-reduced-motion`

## Run locally

Any static server works, e.g.:

```bash
python3 -m http.server 4500
# then open http://localhost:4500
```

## Structure

```
index.html          # all markup + inline SVG + JSON-LD
styles.css          # design tokens + components + sections
script.js           # Lenis + GSAP ScrollTrigger choreography
assets/vendor/      # gsap, ScrollTrigger, lenis (pinned versions)
assets/img/         # images (og image, etc.)
```

## Deploy

Drag the folder onto Netlify, or `vercel`/`netlify deploy`, or any static host
(GitHub Pages, Cloudflare Pages, S3). Nothing to build.
