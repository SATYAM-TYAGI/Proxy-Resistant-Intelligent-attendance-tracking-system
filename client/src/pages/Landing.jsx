import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing-hero">
      <span className="badge">Secure attendance</span>
      <h1>Proxy-Resistant Intelligent Attendance Tracking System</h1>
      <p className="sub">
        Face verification with lightweight liveness checks, role-based dashboards, and duration-based presence rules so
        short check-ins cannot fake a full session.
      </p>
      <div className="landing-actions">
        <Link to="/register/student" className="btn btn-primary">
          Register Student
        </Link>
        <Link to="/register/faculty" className="btn btn-ghost">
          Register Faculty
        </Link>
        <Link to="/login" className="btn btn-ghost">
          Login
        </Link>
      </div>
      <p className="muted" style={{ marginTop: "2.5rem" }}>
        Stack: React · Node/Express · MongoDB · Python (FastAPI + InsightFace)
      </p>
    </div>
  );
}
