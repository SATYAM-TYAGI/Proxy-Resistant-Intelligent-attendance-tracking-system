"""
Single-process InsightFace engine (buffalo_s for lower latency on CPU/GPU).
"""

from __future__ import annotations

import base64
import os
import tempfile
from typing import Any

import cv2
import numpy as np
from insightface.app import FaceAnalysis


def _decode_b64_image(b64: str) -> np.ndarray | None:
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


class FaceEngine:
    def __init__(self) -> None:
        last_err: Exception | None = None
        for name in ("buffalo_s", "buffalo_l"):
            try:
                try:
                    self.app = FaceAnalysis(name=name, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
                    self.app.prepare(ctx_id=0, det_size=(320, 320))
                except Exception:
                    self.app = FaceAnalysis(name=name, providers=["CPUExecutionProvider"])
                    self.app.prepare(ctx_id=-1, det_size=(320, 320))
                return
            except Exception as e:
                last_err = e
                continue
        raise RuntimeError(f"Could not load InsightFace model: {last_err}")

    def decode_frame(self, b64: str) -> np.ndarray | None:
        return _decode_b64_image(b64)

    def largest_face(self, frame: np.ndarray) -> Any | None:
        faces = self.app.get(frame)
        if not faces:
            return None
        return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

    def embedding_from_b64(self, b64: str) -> tuple[np.ndarray | None, np.ndarray | None]:
        frame = self.decode_frame(b64)
        if frame is None:
            return None, None
        face = self.largest_face(frame)
        if face is None:
            return None, None
        emb = np.asarray(face.embedding, dtype=np.float32)
        bbox = np.asarray(face.bbox, dtype=np.float32)
        return emb, bbox

    def embeddings_from_video_bytes(self, video_bytes: bytes, max_frames: int = 12) -> list[np.ndarray]:
        embs: list[np.ndarray] = []
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
            tf.write(video_bytes)
            path = tf.name
        try:
            cap = cv2.VideoCapture(path)
            idx = 0
            step = 3
            while cap.isOpened() and len(embs) < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                if idx % step == 0:
                    face = self.largest_face(frame)
                    if face is not None:
                        embs.append(np.asarray(face.embedding, dtype=np.float32))
                idx += 1
            cap.release()
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
        return embs
