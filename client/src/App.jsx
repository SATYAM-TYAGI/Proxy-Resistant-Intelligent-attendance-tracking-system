import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import RegisterStudent from "./pages/RegisterStudent.jsx";
import RegisterFaculty from "./pages/RegisterFaculty.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import FacultyDashboard from "./pages/faculty/FacultyDashboard.jsx";
import MarkAttendance from "./pages/student/MarkAttendance.jsx";

function PrivateRoute({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "faculty" ? "/faculty" : "/student"} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      <Route path="/register/faculty" element={<RegisterFaculty />} />
      <Route
        path="/student"
        element={
          <PrivateRoute role="student">
            <StudentDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/mark/:classSessionId"
        element={
          <PrivateRoute role="student">
            <MarkAttendance />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <PrivateRoute role="faculty">
            <FacultyDashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
