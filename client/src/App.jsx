import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import RegisterStudent from "./pages/RegisterStudent.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import StudentAttendance from "./pages/student/StudentAttendance.jsx";
import StudentCourses from "./pages/student/StudentCourses.jsx";
import FacultyHome from "./pages/faculty/FacultyHome.jsx";
import FacultyTeaching from "./pages/faculty/FacultyTeaching.jsx";
import FacultyAttendance from "./pages/faculty/FacultyAttendance.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

function defaultHome(role) {
  if (role === "admin") return "/admin";
  if (role === "faculty") return "/faculty";
  return "/student";
}

function PrivateRoute({ role, allowedRoles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const roles = allowedRoles ?? (role ? [role] : null);
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultHome(user.role)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      <Route
        path="/admin"
        element={
          <PrivateRoute role="admin">
            <AdminDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/student"
        element={
          <PrivateRoute role="student">
            <StudentDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/courses"
        element={
          <PrivateRoute role="student">
            <StudentCourses />
          </PrivateRoute>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <PrivateRoute role="student">
            <StudentAttendance />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <PrivateRoute role="faculty">
            <FacultyHome />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty/teaching"
        element={
          <PrivateRoute role="faculty">
            <FacultyTeaching />
          </PrivateRoute>
        }
      />
      <Route
        path="/faculty/attendance"
        element={
          <PrivateRoute role="faculty">
            <FacultyAttendance />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
