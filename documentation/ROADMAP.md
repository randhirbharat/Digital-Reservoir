# Roadmap

Priorities follow from [LIMITATIONS.md](LIMITATIONS.md). Nothing here is implemented yet.

## Near term: production readiness

1. Redis pub/sub event bus, behind the existing bus interface, so the API can run several workers. Also move the simulator and watchdog into a dedicated worker.
2. A background job queue (Redis-based) for long analyses, with progress reporting and cancellation.
3. Commit the browser end-to-end flows as a Playwright suite and run it in CI with axe checks.
4. Admin screens:
   - user management, with membership-category verification for elevated categories;
   - audit log viewer;
   - organisation management.
5. Reduce interaction latency on mobile: lighter mobile-menu hydration, and lazy figure hydration. Re-measure Core Web Vitals on production builds.
6. Test SMTP with a real provider. Add contact-form notifications.
7. Malware scanning of uploads (for example a ClamAV sidecar) before files are stored.

## Digital Twin

- Upload of GLB/glTF asset models, an IFC conversion pipeline (IfcOpenShell), and sensor placement on the imported geometry.
- An OPC UA connector. Hardware-in-the-loop tests with a real logger and gateway.
- Publication of HTT and ML models. Model drift monitoring.
- An editor for criteria workflows, with approval and versioning.

## Engineering Lab

- LSTM, GRU, temporal CNN and autoencoder models, and physics-informed neural networks (PyTorch runtime).
- Stochastic subspace identification (SSI-COV/DATA) for operational modal analysis.
- Kalman and Bayesian model updating.
- Import of FE results (for example from MIDAS FEA NX exports) and their visualisation. Any solver integration only through the vendor's documented interfaces.
- Deep-learning crack segmentation, once labelled training data exist. Image registration for before/after comparison.
- Server-side PDF reports.

## Governance

- A full manual WCAG 2.2 AA audit.
- External penetration testing before any real project data is onboarded.
- Data-retention and deletion policies for each project.
