"""Image-based crack detection (transparent classical baseline).

Pipeline: grayscale → contrast normalisation (CLAHE) → multi-scale ridge filter for dark, thin, elongated features
(Sato) → Otsu threshold → morphology → keep elongated regions darker than the local
background → skeleton.
Outputs are candidate detections with a confidence score; they are NOT engineer-verified findings.
"""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

from .common import AnalysisError, to_jsonable


def _load(data: bytes, max_side: int = 1600) -> np.ndarray:
    try:
        im = Image.open(io.BytesIO(data))
        im.verify()
        im = Image.open(io.BytesIO(data)).convert("L")
    except Exception as exc:  # noqa: BLE001
        raise AnalysisError("The file is not a readable image (PNG or JPEG).") from exc
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side))
    return np.asarray(im, dtype=float) / 255.0


def main_path_length(sk: np.ndarray) -> tuple[float, float]:
    """(geodesic length of the longest path through the skeleton, total skeleton length), in pixels.
    Built as an 8-connected graph (diagonal steps √2); the longest shortest path is found by two Dijkstra passes."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra

    ys, xs = np.nonzero(sk)
    n = len(ys)
    if n < 2:
        return float(n), float(n)
    index = -np.ones(sk.shape, dtype=np.int64)
    index[ys, xs] = np.arange(n)
    rows, cols, w = [], [], []
    H, W = sk.shape
    for dy, dx, wt in ((0, 1, 1.0), (1, 0, 1.0), (1, 1, np.sqrt(2)), (1, -1, np.sqrt(2))):
        y2, x2 = ys + dy, xs + dx
        ok = (y2 >= 0) & (y2 < H) & (x2 >= 0) & (x2 < W)
        j = np.full(n, -1)
        j[ok] = index[y2[ok], x2[ok]]
        m = j >= 0
        rows += list(np.arange(n)[m]); cols += list(j[m]); w += [wt] * int(m.sum())
    G = coo_matrix((w, (rows, cols)), shape=(n, n)).tocsr()
    total = float(G.sum())
    d0 = dijkstra(G, directed=False, indices=0)
    far = int(np.argmax(np.where(np.isfinite(d0), d0, -1)))
    d1 = dijkstra(G, directed=False, indices=far)
    return float(np.max(d1[np.isfinite(d1)])), total


def detect_cracks(data: bytes, mm_per_pixel: float | None = None, sensitivity: float = 1.0, min_length_px: int = 40, sigmas: tuple = (1, 2, 3), min_contrast: float = 0.08) -> dict:
    from skimage import exposure, filters, measure, morphology

    g = _load(data)
    eq = exposure.equalize_adapthist(g, clip_limit=0.02)
    ridge = filters.sato(eq, sigmas=sigmas, black_ridges=True)
    # Otsu always finds *a* threshold, even on crack-free texture, so regions are also required to be clearly
    # darker than their local background (min_contrast) — this rejects shading and surface texture.
    thr = filters.threshold_otsu(ridge) / max(sensitivity, 1e-3)
    mask = ridge > thr
    mask = morphology.remove_small_objects(mask, max_size=30)
    background = filters.gaussian(g, sigma=15)
    lab = measure.label(mask, connectivity=2)
    keep = np.zeros_like(mask)
    cracks = []
    from scipy import ndimage as ndi

    dist = ndi.distance_transform_edt(mask)
    for r in measure.regionprops(lab):
        elong = r.axis_major_length / max(r.axis_minor_length, 1.0)
        if r.axis_major_length < min_length_px or elong < 3:
            continue  # compact blobs (pores, stains) are not crack-like
        region = lab == r.label
        contrast = float(np.mean(background[region] - g[region]))
        if contrast < min_contrast / max(sensitivity, 1e-3):
            continue  # not darker than its surroundings: shading/texture rather than an opening
        sk = morphology.skeletonize(region)
        length_px, skeleton_px = main_path_length(sk)
        if length_px < min_length_px:
            continue
        width_px = float(2 * dist[sk].mean()) if sk.any() else 0.0
        conf = float(np.clip(ridge[region].mean() / (thr * 3), 0, 1) * np.clip(elong / 10, 0, 1))
        keep |= region
        cracks.append({"id": len(cracks) + 1, "bbox": [int(v) for v in r.bbox], "length_px": length_px, "skeleton_length_px": skeleton_px, "mean_width_px": width_px,
                       "max_width_px": float(2 * dist[sk].max()) if sk.any() else 0.0, "orientation_deg": float(np.degrees(r.orientation)), "elongation": float(elong),
                       "confidence": conf, "contrast": contrast,
                       **({"length_mm": length_px * mm_per_pixel, "mean_width_mm": width_px * mm_per_pixel} if mm_per_pixel else {})})
    rgb = np.stack([g, g, g], -1)
    rgb[keep] = [0.88, 0.42, 0.42]
    buf = io.BytesIO()
    Image.fromarray((rgb * 255).astype(np.uint8)).save(buf, format="PNG", optimize=True)
    return to_jsonable({
        "method": "Classical ridge-filter crack detection (CLAHE + Sato + Otsu + morphology)",
        "params": {"sensitivity": sensitivity, "min_length_px": min_length_px, "sigmas": list(sigmas), "min_contrast": min_contrast, "mm_per_pixel": mm_per_pixel},
        "image_size": list(g.shape[::-1]), "n_candidates": len(cracks), "cracks": cracks,
        "crack_area_fraction": float(keep.mean()),
        "overlay_png_base64": base64.b64encode(buf.getvalue()).decode(),
        "status": "model_output_unverified",
        "notes": ["Detections are candidates produced by an algorithm and must be reviewed by an engineer before being recorded as findings.",
                  "Shadows, joints, formwork lines, stains and vegetation can produce false positives; fine cracks below image resolution are missed.",
                  "Length is the main geodesic path of each detection (branches are reported only in the total skeleton length); widths are estimated from the binary mask and are resolution-limited." + ("" if mm_per_pixel else " Provide a scale (mm per pixel) for physical units.")],
    })


def compare(a: dict, b: dict) -> dict:
    """Compare candidate detections of two inspections of the same view (no image registration performed)."""
    la, lb = sum(c["length_px"] for c in a["cracks"]), sum(c["length_px"] for c in b["cracks"])
    return {"total_length_px_before": la, "total_length_px_after": lb, "change_percent": (lb - la) / la * 100 if la else None,
            "note": "Assumes identical viewpoint and scale; images are not registered. Use for screening only."}
