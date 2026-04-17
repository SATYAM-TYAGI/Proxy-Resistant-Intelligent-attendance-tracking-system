from __future__ import annotations

import base64
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from face_engine import FaceEngine
from liveness_simple import check_liveness

app = FastAPI(title="Proxy-Resistant AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine: FaceEngine | None = None


@app.on_event("startup")
def _startup() -> None:
    global engine
    engine = FaceEngine()


def _resize_frame_max_height(frame: np.ndarray, max_h: int = 480) -> np.ndarray:
    h, w = frame.shape[:2]
    if h <= max_h:
        return frame
    scale = max_h / h
    return cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na < 1e-8 or nb < 1e-8:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


class StudentRef(BaseModel):
    sap_id: str
    name: str
    embedding: list[float]


class MarkAttendanceBody(BaseModel):
    frames: list[str] = Field(..., description="JPEG base64 (no data: prefix)")
    students: list[StudentRef]
    threshold: float = 0.45


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/mark-attendance")
def mark_attendance(body: MarkAttendanceBody) -> dict[str, Any]:
    assert engine is not None
    if not body.frames:
        return {"result": "no_face", "detail": "no_frames"}

    frames_bgr: list[np.ndarray] = []
    bboxes: list[np.ndarray | None] = []
    embs: list[np.ndarray] = []

    for b64 in body.frames:
        frame = engine.decode_frame(b64)
        if frame is None:
            continue
        frame = _resize_frame_max_height(frame, 480)
        face = engine.largest_face(frame)
        if face is None:
            frames_bgr.append(frame)
            bboxes.append(None)
            continue
        embs.append(np.asarray(face.embedding, dtype=np.float32))
        frames_bgr.append(frame)
        bboxes.append(np.asarray(face.bbox, dtype=np.float32))

    if len(embs) < 3:
        return {"result": "no_face", "detail": "insufficient_faces"}

    if not check_liveness(frames_bgr, bboxes):
        return {"result": "liveness_failed"}

    probe = np.mean(np.stack(embs, axis=0), axis=0)

    best_name = ""
    best_sap = ""
    best_score = -1.0
    for s in body.students:
        ref = np.asarray(s.embedding, dtype=np.float32)
        score = _cosine(probe, ref)
        if score > best_score:
            best_score = score
            best_name = s.name
            best_sap = s.sap_id

    if best_score >= body.threshold:
        return {
            "result": "success",
            "name": best_name,
            "sap_id": best_sap,
            "confidence": round(best_score, 4),
        }
    return {"result": "unknown", "confidence": round(best_score, 4)}


@app.post("/extract-registration")
async def extract_registration(selfie: UploadFile = File(...), video: UploadFile = File(...)) -> dict[str, Any]:
    assert engine is not None
    selfie_bytes = await selfie.read()
    video_bytes = await video.read()

    b64_selfie = base64.b64encode(selfie_bytes).decode("ascii")
    emb0, _ = engine.embedding_from_b64(b64_selfie)
    if emb0 is None:
        return {"ok": False, "error": "no_face_in_selfie"}

    video_embs = engine.embeddings_from_video_bytes(video_bytes, max_frames=12)
    gallery = [emb0.tolist()] + [e.tolist() for e in video_embs]
    stacked = np.stack([np.asarray(e, dtype=np.float32) for e in gallery], axis=0)
    primary = np.mean(stacked, axis=0).tolist()

    return {"ok": True, "primary_embedding": primary, "gallery_embeddings": gallery}


class ExtractFromB64Body(BaseModel):
    selfie_b64: str
    video_b64: str


@app.post("/extract-registration-b64")
def extract_registration_b64(body: ExtractFromB64Body) -> dict[str, Any]:
    """Same as multipart endpoint; used by Node to avoid temp files."""
    assert engine is not None
    emb0, _ = engine.embedding_from_b64(body.selfie_b64)
    if emb0 is None:
        return {"ok": False, "error": "no_face_in_selfie"}
    raw_vid = base64.b64decode(body.video_b64)
    video_embs = engine.embeddings_from_video_bytes(raw_vid, max_frames=12)
    gallery = [emb0.tolist()] + [e.tolist() for e in video_embs]
    stacked = np.stack([np.asarray(e, dtype=np.float32) for e in gallery], axis=0)
    primary = np.mean(stacked, axis=0).tolist()
    return {"ok": True, "primary_embedding": primary, "gallery_embeddings": gallery}
