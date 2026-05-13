import { useCallback, useEffect, useRef, useState } from "react";
import api, { setKioskDeviceId } from "../api/client.js";
import { getDeviceId } from "../utils/deviceId.js";
import { captureFramesFromVideo } from "../utils/captureFrames.js";

const COOLDOWN_AFTER_SUCCESS_MS = 7500;
const SCAN_INTERVAL_MS = 7000;

export default function Home() {
  const deviceIdRef = useRef(getDeviceId());
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [banner, setBanner] = useState("");
  const [hint, setHint] = useState("");
  const [starting, setStarting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const scanLoopRef = useRef(null);

  const refreshDevice = useCallback(async () => {
    const id = deviceIdRef.current;
    setKioskDeviceId(id);
    await api.post("/kiosk/register", { deviceId: id });
    const { data } = await api.get("/kiosk/status", { params: { deviceId: id } });
    setDeviceStatus(data.status);
  }, []);

  const refreshSessions = useCallback(async () => {
    setKioskDeviceId(deviceIdRef.current);
    const { data } = await api.get("/kiosk/sessions-today");
    setSessions(data);
  }, []);

  useEffect(() => {
    refreshDevice().catch(() => setDeviceStatus("unknown"));
  }, [refreshDevice]);

  useEffect(() => {
    if (deviceStatus !== "approved") return;
    refreshSessions().catch(() => {});
    const t = setInterval(() => refreshSessions().catch(() => {}), 12000);
    return () => clearInterval(t);
  }, [deviceStatus, refreshSessions]);

  const stopCam = () => {
    streamRef.current?.getTracks?.().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const startCam = async () => {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  };

  useEffect(() => {
    return () => {
      stopCam();
      if (scanLoopRef.current) clearInterval(scanLoopRef.current);
    };
  }, []);

  const activeSession = sessions.find((s) => s.status === "active") || null;

  useEffect(() => {
    if (scanLoopRef.current) {
      clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (deviceStatus !== "approved" || !activeSession) {
      stopCam();
      setBanner("");
      setHint("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await startCam();
      } catch {
        if (!cancelled) setHint("Allow camera access so students can mark attendance.");
      }
    })();

    const tick = async () => {
      if (cancelled || busyRef.current) return;
      const v = videoRef.current;
      if (!v || !streamRef.current) return;
      busyRef.current = true;
      setHint("Looking for a face…");
      try {
        const frames = await captureFramesFromVideo(v, {});
        if (frames.length < 3) {
          setHint("Hold still — not enough frames. Next try in a few seconds.");
          busyRef.current = false;
          return;
        }
        setKioskDeviceId(deviceIdRef.current);
        const { data } = await api.post("/kiosk/mark-student", { classSessionId: activeSession._id, frames });
        if (data.result === "attendance_marked") {
          setBanner(`Attendance marked (${data.name} (${data.sapId}))`);
          setHint("");
          await refreshSessions();
          setTimeout(() => {
            setBanner("");
            busyRef.current = false;
          }, COOLDOWN_AFTER_SUCCESS_MS);
        } else {
          setHint(
            data.result === "liveness_failed"
              ? "Liveness check failed — move naturally and try again."
              : "Not recognised against this class roster — try again."
          );
          setTimeout(() => {
            setHint("");
            busyRef.current = false;
          }, 5000);
        }
      } catch (e) {
        const code = e.response?.data?.error;
        if (code === "already_marked") {
          const n = e.response?.data?.name;
          const s = e.response?.data?.sapId;
          setBanner(`Already marked (${n} (${s})) — next student.`);
          setHint("");
          setTimeout(() => {
            setBanner("");
            busyRef.current = false;
          }, COOLDOWN_AFTER_SUCCESS_MS);
        } else {
          setHint("Could not reach server — retrying…");
          setTimeout(() => {
            busyRef.current = false;
          }, 4000);
        }
      }
    };

    scanLoopRef.current = setInterval(tick, SCAN_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (scanLoopRef.current) clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
      stopCam();
    };
  }, [deviceStatus, activeSession?._id, refreshSessions]);

  const canStartEarly = (s) => {
    const now = Date.now();
    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();
    return now <= end && now >= start - 5 * 60 * 1000;
  };

  const runStartClass = async (classSessionId) => {
    setStarting(true);
    setHint("");
    setBanner("");
    try {
      await startCam();
      const frames = await captureFramesFromVideo(videoRef.current, {});
      if (frames.length < 3) {
        setHint("Not enough frames — adjust lighting and try again.");
        return;
      }
      setKioskDeviceId(deviceIdRef.current);
      await api.post("/kiosk/start-class", { classSessionId, frames });
      setBanner("Class started — students may mark one by one.");
      await refreshSessions();
      setTimeout(() => setBanner(""), 4000);
    } catch (e) {
      const err = e.response?.data;
      setHint(err?.message || err?.error || "Could not verify faculty or start class.");
    } finally {
      setStarting(false);
    }
  };

  if (deviceStatus !== "approved") {
    return (
      <div className="kiosk-shell">
        <aside className="kiosk-sidebar">
          <div className="brand">Classroom kiosk</div>
        </aside>
        <div className="kiosk-main">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Device setup</h2>
            <p className="mono" style={{ wordBreak: "break-all" }}>
              {deviceIdRef.current}
            </p>
            <p className="muted">
              Status: <strong>{deviceStatus || "…"}</strong>
            </p>
            <p className="muted">Administrator: approve this device and set the classroom in the admin portal.</p>
            <button type="button" className="btn btn-ghost" onClick={() => refreshDevice().catch(() => {})}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roomLabel = sessions.find((s) => s.classroom)?.classroom || "this room";

  return (
    <div className="kiosk-shell">
      <aside className="kiosk-sidebar">
        <div className="brand">Classroom kiosk</div>
        <p className="muted" style={{ color: "rgba(248,250,252,0.9)", fontSize: "0.85rem" }}>
          No passwords — camera only. Room <strong>{roomLabel}</strong>
        </p>
      </aside>
      <div className="kiosk-main">
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>Today</h2>
            <p className="muted" style={{ margin: 0 }}>
              Faculty can start up to <strong>5 minutes</strong> before the scheduled time; that moment becomes the official start for
              attendance timing.
            </p>
          </div>
        </div>

        {banner && (
          <div className="card" style={{ marginBottom: "1rem", borderColor: "#86efac", background: "#f0fdf4" }}>
            <strong>{banner}</strong>
          </div>
        )}

        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Classes in this room</h3>
          {!sessions.length && <p className="muted">No sessions today.</p>}
          {sessions.map((s) => (
            <div key={s._id} className="session-row">
              <div>
                <strong>{s.subjectId?.name}</strong> · {s.courseId?.name}
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {new Date(s.startTime).toLocaleTimeString()}–{new Date(s.endTime).toLocaleTimeString()} ·{" "}
                  <span className={s.status === "active" ? "badge success" : "badge warn"}>{s.status}</span>
                </div>
              </div>
              {s.status !== "active" && canStartEarly(s) && (
                <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem" }} disabled={starting} onClick={() => runStartClass(s._id)}>
                  {starting ? "Starting…" : "Start class (faculty face)"}
                </button>
              )}
            </div>
          ))}
        </div>

        {activeSession && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Student line</h3>
            <p className="muted">One student at a time in front of the camera. Scans repeat about every {SCAN_INTERVAL_MS / 1000} seconds.</p>
            {hint && <p className="muted">{hint}</p>}
            <div className="scan-wrap">
              <video ref={videoRef} playsInline muted />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
