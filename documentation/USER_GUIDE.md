# User guide

Digital Reservoir has three applications that share one account. The **app switcher** in the header of every app moves between them. You stay signed in when you switch.

## Reading the labels

| Label | Meaning |
|---|---|
| **Live measured** / **Historical measured** | Data from a registered sensor or gateway, or from historical measured records |
| **Demonstration data** | A simulated stream. It does not measure any real structure. |
| **Synthetic** | A generated example dataset, documented in `datasets/README.md` |
| **Imported** | Third-party data loaded by a user |
| **Modelled** | A model output, such as an HST prediction or a published model |
| Condition chips: *Normal*, *Attention*, *Warning*, *Critical*, *Data unavailable*, **Not assessed** | Each chip has a colour, a shape and a word. *Not assessed* means no documented criterion exists for that sensor. The platform never invents a threshold. |

## 01 Public website

The public website needs no account. It contains:

- research areas;
- technology pages with interactive figures (HST, filtering, regression, fragility, SDOF response, DHI aggregation), all running on labelled synthetic data;
- application pages;
- articles;
- publications, with filters by type, subject, period, author and journal;
- search;
- the contact form.

## 02 Engineering Lab

### Getting started

1. **Register** with your name, organisation, email, password and membership category.
2. **Verify your email** with the link that is sent to you.
3. **Sign in.** We recommend turning on MFA under *Account*.

Your category decides which analyses you can use:

| Category | Analyses |
|---|---|
| General | Datasets, quality, signal, statistics, HST |
| Student | The General set, plus ML and anomaly detection |
| Researcher and Professional | Everything above, plus DHI, the advanced modules and reports |

Upload limits are 10 MB, 25 MB and 100 MB respectively.

### Typical workflow

1. **Projects (optional).** Group your datasets and runs.
2. **Datasets.**
   - Upload a CSV or XLSX file, or *Import sample*.
   - The original file is stored unchanged as version 0.
   - Check the preview and the column types, set the time column, and set the units.
3. **Quality and processing.**
   - Find missing values, duplicates, timestamp problems, gaps and outliers (Hampel or global MAD).
   - Resample the data or convert units.
   - Each processing step creates a **new version**, with its history recorded.
4. **Analyses.**
   - Choose a dataset version, then the columns, then the parameters.
   - **Signal:** filters, FFT, PSD, CWT, STL. Cut-off frequencies can be given in Hz or in cycles/day for daily data.
   - **Statistics:** descriptive statistics, correlation, regression, PCA, factor analysis, time-series tests.
   - **HST / HTT:**
     - Choose calibration and validation periods **in time order**.
     - The results show the coefficients with confidence intervals, the components, the prediction intervals and the residual screening.
     - A warning appears when the reservoir level falls outside the calibration range.
   - **ML:**
     - Choose one or more models and a validation scheme: holdout, rolling origin or frozen test set.
     - The results show prediction intervals (split-conformal) and permutation importance.
     - MAPE is hidden when values are close to zero.
   - **Anomaly:** z-score, CUSUM, change points, Mahalanobis distance, isolation forest.
   - **DHI:** you supply the indicators, the bounds and the weights (direct or AHP; the consistency ratio is shown). The result includes a sensitivity analysis. There are no defaults.
   - **Hybrid:** an HST or supplied physics column, plus an ML model of the residuals, compared with physics alone.
   - **Modal:** FDD on vibration records, peak picking, damping, MAC.
   - **Fragility:** multiple stripes (MLE) or IDA, with bootstrap confidence intervals.
   - **Vision:**
     - Upload a photograph and give the scale (mm/px) if you know it.
     - Review the detected crack candidates. Record your decision and the defect location.
     - Compare a *before* and an *after* image.
5. **Runs.**
   - Every run keeps its dataset version, parameters and engine version.
   - Open a report (HTML; print it to PDF) or export the results as CSV.
   - An HST run can be **published to a Digital Twin project**. This needs the publish permission in that project.

## 03 Digital Twin

### Access

- You need an **invitation** from a project administrator, or an **access request** that has been approved. Request access from the project list.
- Projects that require MFA ask you to enrol a TOTP authenticator and to sign in with a code.
- The project list shows the projects that allow access requests, marked *No access*. Any project page you are not a member of returns *not found*, including when you type its address directly.

### Project pages

| Page | What you can do | Role needed |
|---|---|---|
| Overview | KPIs, latest readings (unit, timestamp, source, quality, communications, condition and its basis), live trend, recent alerts. Updates arrive live; the indicator shows when the connection is live. | any member |
| 3D model | Orbit or zoom; toggle layers (reservoir, galleries, foundation, sensors); select a sensor or component; compare two periods; open a sensor's chart. A keyboard-accessible sensor list mirrors the 3D view. | any member |
| Monitoring | Sensor groups, time windows, refresh mode, comparison periods, criteria lines, quality flags, reservoir-level overlay, correlation, data availability, replay, CSV export | any member; export needs `export` |
| Alerts | Criteria alerts, communications alerts, model-deviation alerts; acknowledge with a comment | acknowledging needs `alert_ack` |
| Model | Published models, model against observation, deviation, extrapolation warnings | any member |
| Sensors | The sensor registry (metadata, coordinates, calibration, frequency, source), criteria with a documented reference, gateways (the ingestion key is shown once) | managing needs `sensors_manage` or `criteria_edit` |
| Access | Members and roles, invitations, access requests, project audit trail | `members_manage` |

The roles are:

- **Project administrator:** everything.
- **Project engineer:** everything except managing members.
- **Researcher:** view and export.
- **Monitoring operator:** view and acknowledge alerts.
- **Viewer:** view only.

**Analyse in Engineering Lab** (on the Monitoring page) exports the selected sensor series into a new Lab dataset and keeps its provenance. It needs the `export` permission and Lab access.

## The demonstration project (PRJ-D)

PRJ-D is an illustrative gravity dam with 12 simulated sensors. Its banner reads **DEMONSTRATION DATA** on every page. It shows two scenarios:

- Piezometer **PZ-03** periodically rises above its *demonstration* attention criterion, so you can see the alert workflow.
- Thermometer **TM-12** stops reporting, so you can see the communications watchdog.

None of these values or criteria describe a real dam.
