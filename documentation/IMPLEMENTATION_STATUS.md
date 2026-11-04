# Implementation status

Legend: ✅ complete · 🟡 partial · 🧪 simulated/demonstration · ⏳ pending

| Stage | Item | Status | Notes |
|---|---|---|---|
| 1 | Monorepo skeleton | ✅ | apps/, services/, packages/, infrastructure/ |
| 1 | Brand: logo (light/dark/mark), palette, typography, tokens | ✅ | packages/design-system |
| 1 | Shared components (buttons, cards, provenance + condition badges, app switcher) | ✅ | |
| 1 | Shared utilities (formatting, app URLs, provenance labels) + tests | ✅ | |
| 1 | Visual prototype, 10 screens, desktop/tablet/mobile | ✅ | awaiting approval |
| 2 | Public website — 10 main sections, 18 technology pages, 8 application pages, 4 articles | ✅ | Next.js 16, static pre-rendering (44 pages) |
| 2 | Interactive figures (HST, Butterworth filter, OLS, fragility, SDOF FRF, DHI aggregation) | ✅ | client-side, synthetic data labelled |
| 2 | Research search, publication filters (type/subject/period/author/journal) | ✅ | own publications list empty until verified records are supplied |
| 2 | Contact form with validation + honeypot | 🟡 | front-end complete; API endpoint arrives in Stage 3 |
| 2 | SEO: metadata, sitemap.xml, robots.txt | ✅ | |
| 2 | Accessibility: axe WCAG 2.2 AA on 6 key pages, keyboard skip link | ✅ | 0 violations on audited pages; full manual audit pending |
| 2 | Synthetic datasets + generator script, hst_example.py | ✅ | datasets/ |
| 2 | Licensed dam photography | ⏳ | illustration used, labelled |
| 3 | Engineering Lab (auth, upload, QC, signal, stats, HST, PCA, ML) | ⏳ | |
| 4 | Digital Twin (dashboard, simulated stream, 3D dam) | ⏳ | |
| 5 | Integration (SSO, shared APIs, RLS) | ⏳ | |
| 6 | Advanced (hybrid/PINN, fragility, damage detection) | ⏳ | |
