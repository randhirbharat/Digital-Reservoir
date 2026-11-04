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
| 4 | Twin data model: assets, components, sensor registry (metadata, coordinates, calibration, frequency, source, status), observations, criteria, alerts, gateways, invitations, access requests; migration 0002 | ✅ | TimescaleDB hypertable created automatically when the extension is available (not installed in the test environment — plain PostgreSQL verified) |
| 4 | Project-level authorisation: 5 roles, superadmin, institutional admin; 404 for non-members; MFA-verified session required per project | ✅ | 7 Twin security tests; enforced in REST and WebSocket |
| 4 | Invitations (email, single-use, 7-day), access requests with approval, role change/revocation ending sessions, project audit trail | ✅ | |
| 4 | Gateway ingestion (REST, per-gateway key, rate limit, validation: tz-aware, no future timestamps, unknown sensors rejected) | ✅ | |
| 4 | MQTT → REST bridge with store-and-forward; CSV replay | 🟡 | unit-tested with simulated messages; not tested against a real broker or hardware |
| 4 | OPC UA connector | ⏳ | interface documented; needs site details |
| 4 | Demonstration simulator (source=simulated) + communications watchdog + missing-data alerts | 🧪 | always labelled DEMONSTRATION DATA |
| 4 | Live WebSocket stream with reconnect; polling fallback; session/membership re-check every 30 s | ✅ | single API process (in-memory bus); Redis pub/sub needed for multiple workers |
| 4 | Dashboard: KPIs, latest readings with unit/timestamp/source/quality/comms/condition+basis, live trend, alerts | ✅ | |
| 4 | 3D: Three.js parametric illustrative dam, layers, orbit, sensor selection, component picking, labels, keyboard sensor list, period comparison, 3D↔chart links | ✅ | GLB/glTF upload & IFC conversion pipeline pending |
| 4 | Monitoring: groups, windows, refresh modes, comparison, criteria lines, quality flags, level overlay, correlation, availability, replay, CSV export | ✅ | LTTB downsampling for display; flagged points always kept |
| 4 | Conditions from documented criteria only; 'not assessed' without criteria; demonstration criteria labelled | ✅ | |
| 4 | Twin E2E (browser): MFA enforcement, live stream, 3D, monitoring, alerts, access, URL manipulation, mobile/tablet | ✅ | |
| 5 | Integration (SSO, shared APIs, RLS) | ⏳ | |
| 6 | Advanced (hybrid/PINN, fragility, damage detection) | ⏳ | |
