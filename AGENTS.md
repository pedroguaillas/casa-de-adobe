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

Astro 7 project (no React/Vue/Svelte integrations, no Tailwind). Pure `.astro` components only.

**Data flow:** `src/pages/*.astro` → imports `src/layouts/Layout.astro` (HTML shell with `<slot />`) → imports `src/components/*.astro`

**Assets:** Files in `src/assets/` are processed by Astro (import and use `.src`). Files in `public/` are served as-is.

**Styles:** Scoped per-component via `<style>` blocks inside `.astro` files. No global stylesheet.

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
