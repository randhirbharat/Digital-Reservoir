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
| 3 | Identity API: register, email verification, login, lockout, rate limits, MFA (TOTP), password reset/change, sessions, audit log | ✅ | Argon2id, opaque revocable sessions, CSRF header + origin check |
| 3 | Email delivery | 🟡 | console/outbox backend tested; SMTP backend implemented, not tested against a real server |
| 3 | Lab permissions by membership category; superadmin user management | ✅ | enforced server-side; tested |
| 3 | Datasets: CSV/XLSX upload + validation, preview, column/units, immutable originals, versioned processing with history, export | ✅ | malware-scanning hook documented, scanner not integrated |
| 3 | Data quality: missing, duplicates, timestamps, gaps, Hampel/global MAD outliers, resampling, unit conversion | ✅ | |
| 3 | Signal processing: baseline, detrend, moving average, Butterworth LP/HP/BP (zero-phase), FFT, Welch PSD, CWT, STL | ✅ | |
| 3 | Statistics: descriptive, correlation, OLS/multiple/polynomial + CI/PI + diagnostics, PCA, factor analysis, ACF/PACF/ADF, hypothesis tests | ✅ | |
| 3 | HST/HTT: chronological calibration/validation, components, coefficients+CI, PI, residual screening, warnings | ✅ | engine tests verify recovery of synthetic generator |
| 3 | ML: linear, Ridge, Lasso, SVR, KNN, tree, RF, GBR, XGBoost, MLP; holdout / rolling-origin / frozen test; conformal PI; permutation importance | ✅ | LSTM/GRU/CNN/autoencoder/PINN pending (Stage 6) |
| 3 | Damage indicators: z-score, CUSUM, change points, Mahalanobis, isolation forest | ✅ | |
| 3 | Dam Health Index: indicators, normalisation, direct/AHP weights + CR, 3 aggregations, sensitivity, history, period comparison | ✅ | no default weights/thresholds by design |
| 3 | Reports (HTML, print to PDF) and CSV export of results | ✅ | server-side PDF rendering not implemented |
| 3 | Background job queue for long analyses | ⏳ | analyses run synchronously; Redis queue planned |
| 3 | Alembic migration 0001; tests on SQLite and PostgreSQL 16 | ✅ | 17 API tests, 11 engine tests, 12-step browser E2E |
| 4 | Digital Twin (dashboard, simulated stream, 3D dam) | ⏳ | |
| 5 | Integration (SSO, shared APIs, RLS) | ⏳ | |
| 6 | Advanced (hybrid/PINN, fragility, damage detection) | ⏳ | |
