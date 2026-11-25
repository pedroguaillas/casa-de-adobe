# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # dev server at localhost:4321
npm run build        # production build to ./dist/
npm run preview      # preview production build
npm run astro check  # TypeScript / type checking
```

When starting the dev server, use background mode:

```sh
astro dev --background
```

Manage with `astro dev stop`, `astro dev status`, `astro dev logs`.

## Architecture

Astro 7 + one React island (`@astrojs/react`), no Tailwind. 3D first-person tour of a house
built from architectural plans: `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`.

**Data flow:** `src/pages/index.astro` → `Layout.astro` → `<HouseTour client:only="react" />`
→ `Scene.jsx` (procedural house from plan dimensions), `PlayerController.jsx` (capsule +
rapier character controller), overlays (`LoadingScreen`, `Instructions`, `FloorIndicator`,
`TouchControls`). Shared state in `src/lib/` (`input.js`, `quality.js` device tiers, `materials.js`).

**Dimensions:** `resources/ANALISIS.md` is the source of truth (axes, levels, room bounds,
stair). Plans live in `resources/*.pdf`; plan cotas win over renders.

**Testing (dev only):** `window.__tour.{teleport(x,y,z), look(yaw,pitch), press(key,bool), force}`
lets a browser script walk the house without pointer lock; `?debug` draws colliders.

**Assets:** Files in `src/assets/` are processed by Astro (import and use `.src`). Files in `public/` are served as-is.

**Styles:** Overlay UI in `src/styles/overlay.css`; `.astro` files use scoped `<style>`.

**No content collections, no routing beyond `src/pages/`, no middleware.**

## Documentation

Full docs: https://docs.astro.build

Guides for common tasks:
- [Pages, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components (React/Vue/Svelte)](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling / Tailwind](https://docs.astro.build/en/guides/styling/)
- [i18n](https://docs.astro.build/en/guides/internationalization/)
