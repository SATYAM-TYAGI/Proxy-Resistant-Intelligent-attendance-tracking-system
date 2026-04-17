"""
Lightweight liveness heuristics (no dlib / no external landmark models).
Uses face motion, Laplacian sharpness, and frame-to-frame difference.
"""

from __future__ import annotations

import cv2
import numpy as np


def _laplacian_var(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _bbox_center(bbox) -> tuple[float, float]:
    x1, y1, x2, y2 = map(float, bbox[:4])
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def check_liveness(frames_bgr: list[np.ndarray], bboxes: list[np.ndarray | None]) -> bool:
    """
    frames_bgr: BGR uint8 frames (same length as bboxes).
    bboxes: per-frame face bbox [x1,y1,x2,y2] or None.
    """
    valid = [(f, b) for f, b in zip(frames_bgr, bboxes) if b is not None and len(b) >= 4]
    if len(valid) < 4:
        return False

    centers = []
    sharp = []
    diffs = []
    prev_gray = None

    for frame, bbox in valid:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharp.append(_laplacian_var(gray))
        centers.append(_bbox_center(bbox))
        if prev_gray is not None:
            g1 = cv2.resize(prev_gray, (160, 120))
            g2 = cv2.resize(gray, (160, 120))
            diffs.append(float(np.mean(cv2.absdiff(g1, g2))))
        prev_gray = gray

    cx = np.array([c[0] for c in centers])
    cy = np.array([c[1] for c in centers])
    motion = float(np.std(cx) + np.std(cy))
    texture_ok = float(np.mean(sharp)) > 35.0
    motion_ok = motion > 4.0
    flicker_ok = (float(np.mean(diffs)) > 2.0) if diffs else False

    return texture_ok and motion_ok and flicker_ok
