import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing-hero">
      <span className="badge">Secure attendance</span>
      <h1>Proxy-Resistant Intelligent Attendance Tracking System</h1>
      <p className="sub">
        Face verification with lightweight liveness checks, admin-managed enrollment, subject-linked timetables, and classroom tablets
        for check-in. Faculty start sessions only after face verification on the room&apos;s approved device.
      </p>
      <div className="landing-actions">
        <Link to="/login" className="btn btn-primary">
          Login
        </Link>
        <Link to="/register/student" className="btn btn-ghost">
          Register as student
        </Link>
      </div>
      <p className="muted" style={{ marginTop: "2.5rem" }}>
        Attendance marking runs on the separate <strong>classroom kiosk</strong> (no passwords there — the tablet recognises students and
        faculty by face only). Ask your administrator for the kiosk URL after devices are approved.
      </p>
      <p className="muted">
        Stack: React · Node/Express · MongoDB · Python (FastAPI + InsightFace). Faculty accounts are created by an admin after you sign
        in with the seeded admin account (created automatically on first API start when the database is empty).
      </p>
    </div>
  );
}
