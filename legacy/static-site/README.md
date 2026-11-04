# Digital Reservoir HST tools page

Standalone browser-based HST analysis and prediction workbench.

## Features

- CSV upload and column mapping
- Built-in demonstration data
- Linear or quadratic hydrostatic terms
- Annual sine/cosine seasonal terms
- Linear time term
- Training/validation split option
- Observed versus predicted graph
- Component graph
- Standardised residual and threshold graph
- Simple forecast graph
- Anomaly screening
- Results table
- CSV template and results export

## Deploy

Open `tools.html` directly or upload it to GitHub Pages. The page uses Chart.js from jsDelivr. For offline deployment, download and self-host the approved Chart.js library according to its licence.

## Engineering limitation

This is a preliminary educational implementation. It uses ordinary least squares in the browser and does not replace project-specific HST model selection, data-quality review, confidence-interval analysis, physical interpretation, statutory review or qualified engineering judgement.
