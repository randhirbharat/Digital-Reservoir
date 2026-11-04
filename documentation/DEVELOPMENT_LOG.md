# Development log

## Stage 1 — brand and architecture
- Diagnosed original repo (missing assets, JS syntax error); preserved site in `legacy/static-site/`.
- Monorepo skeleton, design tokens for three app themes, logo (light/dark/mark), shared components.
- 10-screen visual prototype (desktop/tablet/mobile) — approved by the owner.

## Stage 2 — public website
- Next.js 16 App Router site in `apps/public-website`, using `@dr/design-system`.
- Content: 18 technology pages (theory, equations, workflow, inputs, methods, applications, figure, references, Lab links),
  8 application pages, 4 original articles, resources, publications catalogue, Lab and Twin landing pages, about, contact, legal.
- References limited to well-established works; DOIs only where widely reproduced; editorial verification note shown.
- Verification: production build; Playwright crawl of 43 pages (0 broken links, 0 runtime errors); axe-core WCAG 2.2 AA
  on 6 pages (0 violations after fixing one contrast issue and focusable scroll regions); no horizontal overflow at
  390/834/1440 px after fixing grid min-width issues and moving access buttons to a utility bar at desktop widths.
