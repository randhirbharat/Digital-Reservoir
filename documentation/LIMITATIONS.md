# Known limitations

This list is deliberately plain. Nothing below is claimed anywhere else in the product.

## Data and content

- **No real monitoring data.**
  - Every dataset is synthetic (`datasets/`) or simulated (the Twin demonstration project PRJ-D), and is labelled that way.
  - The demonstration dam "DGD-01" is a parametric illustration, not an existing structure.
- **The demonstration criteria are illustrative.**
  - The PRJ-D alert thresholds are flagged `is_demonstration` and described as "not a project-approved threshold".
  - Real projects show **"not assessed"** until an engineer enters criteria with a documented reference.
- **No default Dam Health Index weights or thresholds.** The user must supply weights (directly or through AHP) and the indicator bounds. This is by design.
- **No publications are listed as the platform's own.** The publication list is empty until verified records are supplied. The reference lists cite external standard literature only.
- **No licensed dam photography.** The illustrations are labelled.

## Engineering scope

- No finite-element solver is included, and the MIDAS FEA NX integration is not implemented. FE results can be used only as a column in hybrid modelling.
- Model publication from the Lab to the Twin supports **HST (seasonal)** models only. HTT and ML model publication are pending.
- These methods are not implemented, because they need the PyTorch runtime or more design work:
  - LSTM, GRU, CNN, autoencoders and PINNs;
  - stochastic subspace identification (SSI);
  - Kalman or Bayesian model updating.
- Crack detection is a **classical image-processing baseline**:
  - it has no deep-learning segmentation, because there is no labelled training data;
  - it does no image registration for before/after comparison;
  - the measurements are in pixels unless the user supplies a scale;
  - every result needs an engineer's review, and the UI asks for one.
- Analyses run **synchronously** in the API request. There is no job queue yet.
- The 3D model is a **parametric illustration**. Upload of GLB/glTF models and IFC conversion are not implemented.

## Integration and hardware

- **No hardware has been tested.**
  - The MQTT bridge and CSV replay are tested with simulated messages only.
  - No real logger, gateway or broker in the field has been connected.
- OPC UA is not implemented.
- The SMTP email backend is implemented but **not tested against a real mail server**. The console/outbox backend is tested.
- There is no malware scanning of uploads. Uploads are validated only for file type, size and table structure.

## Platform

- The live event bus runs **in memory in one API process**. Running several API workers needs the Redis pub/sub bus, which is planned.
- **Lab membership categories are self-declared at registration.** For example, choosing *professional* grants the advanced analyses straight away. An administrator can change a user's category through the API. There is no verification step or admin screen yet.
- Rotating `DR_SECRET_KEY` makes the stored MFA secrets unreadable, so users must re-enrol.
- The contact form stores messages but does not notify anyone.
- Server-side PDF rendering is not implemented. Reports are HTML designed for printing to PDF.
- Accessibility: there were 0 axe violations on the audited pages. A full manual WCAG 2.2 audit, including testing with screen-reader users, has not been done.
- Performance has been measured locally on development builds only (see [TESTING.md](TESTING.md)). Interactions on throttled mobile exceed the 200 ms INP target.
- The browser end-to-end scripts are not yet a committed, CI-run Playwright suite.
- The production deployment (subdomains, TLS, backups) is documented but **has not been deployed** by this project.
