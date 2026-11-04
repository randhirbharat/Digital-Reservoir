"""Minimal HST fit on the Digital Reservoir SYNTHETIC example dataset (educational).

Usage: python hst_example.py demo_gravity_dam_daily.csv
Requires numpy and pandas. Calibration = first 80 % of the record, validation = last 20 % (chronological).
"""
import sys
import numpy as np
import pandas as pd

df = pd.read_csv(sys.argv[1], comment="#", parse_dates=["timestamp"]).drop_duplicates()
df = df.dropna(subset=["PL01_disp_mm", "reservoir_level_m"]).sort_values("timestamp")
H = df["reservoir_level_m"].to_numpy()
h = (H.max() - H) / (H.max() - H.min())
s = 2 * np.pi * df["timestamp"].dt.dayofyear.to_numpy() / 365.25
t = (df["timestamp"] - df["timestamp"].iloc[0]).dt.days.to_numpy() / 365.25
X = np.column_stack([np.ones_like(h), h, h**2, h**3, h**4, np.sin(s), np.cos(s), np.sin(s) ** 2, np.sin(s) * np.cos(s), t, np.log1p(t)])
y = df["PL01_disp_mm"].to_numpy()
n_cal = int(0.8 * len(y))
beta, *_ = np.linalg.lstsq(X[:n_cal], y[:n_cal], rcond=None)
pred = X @ beta
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
print(f"calibration RMSE {rmse(y[:n_cal], pred[:n_cal]):.3f} mm | validation RMSE {rmse(y[n_cal:], pred[n_cal:]):.3f} mm")
