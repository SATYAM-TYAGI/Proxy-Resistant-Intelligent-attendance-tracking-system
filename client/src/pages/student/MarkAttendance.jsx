import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client.js";
import StudentLayout from "../../components/StudentLayout.jsx";
import { captureFramesFromVideo } from "../../utils/captureFrames.js";

export default function MarkAttendance() {
  const { classSessionId } = useParams();
  const nav = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("init");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = async () => {
    setMessage("");
    setDetail(null);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setPhase("ready");
  };

  const runScan = async () => {
    const v = videoRef.current;
    if (!v) return;
    setPhase("scanning");
    setMessage("Hold still — capturing a short burst of frames…");
    const frames = await captureFramesFromVideo(v, { maxWidth: 400, quality: 0.5, durationMs: 2400, minIntervalMs: 300 });
    if (frames.length < 4) {
      setPhase("ready");
      setMessage("Not enough frames — try better lighting.");
      return;
    }
    setMessage("Verifying face + liveness on the AI service…");
    try {
      const { data } = await api.post("/attendance/mark-ai", { classSessionId, frames });
      if (data.result === "liveness_failed") {
        setPhase("done");
        setMessage("Liveness failed");
        setDetail("Move naturally, ensure your face is visible, and avoid a static photo.");
      } else if (data.result === "unknown") {
        setPhase("done");
        setMessage("Unknown person");
        setDetail("Face did not match your enrolled profile closely enough.");
      } else if (data.result === "no_face") {
        setPhase("done");
        setMessage("No face detected");
      } else if (data.result === "attendance_marked") {
        setPhase("done");
        setMessage(`Attendance marked for ${data.name}`);
        setDetail(
          `Entry recorded. Stay for at least 70% of the scheduled class or use “Mark leave” when you exit. Current progress: ${data.attendancePercentage ?? 0}%.`
        );
      } else {
        setPhase("done");
        setMessage("Could not complete verification");
      }
    } catch (e) {
      setPhase("ready");
      const code = e.response?.data?.error;
      if (code === "ai_service_unavailable") setMessage("AI service unreachable.");
      else if (code === "no_active_class") setMessage("This class is not active.");
      else setMessage("Request failed — try again.");
    }
  };

  const stopCam = () => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase("init");
  };

  return (
    <StudentLayout title="Mark attendance">
      <div className="card">
        <p className="muted">
          Low-latency mode: only a handful of compressed frames are sent (not full video). Use a normal phone or laptop camera.
        </p>
        <div className="scan-wrap">
          <video ref={videoRef} playsInline muted />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {phase === "init" && (
            <button type="button" className="btn btn-primary" onClick={startCamera}>
              Open camera
            </button>
          )}
          {phase === "ready" && (
            <>
              <button type="button" className="btn btn-primary" onClick={runScan}>
                Start scan
              </button>
              <button type="button" className="btn btn-ghost" onClick={stopCam}>
                Close camera
              </button>
            </>
          )}
          {phase === "scanning" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="spinner" />
              <span>Working…</span>
            </div>
          )}
          {phase === "done" && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => nav("/student")}>
                Back to dashboard
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setPhase("ready");
                  setMessage("");
                  setDetail(null);
                }}
              >
                Scan again
              </button>
            </>
          )}
        </div>
        {message && (
          <p style={{ marginTop: "1rem", color: message.includes("failed") || message.includes("Unknown") ? "var(--danger)" : "var(--success)" }}>
            {message}
          </p>
        )}
        {detail && <p className="muted">{detail}</p>}
        <p style={{ marginTop: "1rem" }}>
          <Link to="/student">← Dashboard</Link>
        </p>
      </div>
    </StudentLayout>
  );
}
