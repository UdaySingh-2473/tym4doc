import { useState, useEffect } from "react";
import s from "./constants/styles";
import C from "./constants/colors";

import { ClinicProvider, useClinic }           from "./context/ClinicContext";
import { AppointmentProvider, useAppointment } from "./context/AppointmentContext";
import { AuthProvider, useAuth }               from "./context/AuthContext";

import useToast from "./hooks/useToast";

import Navbar     from "./components/shared/Navbar";
import AdminModal from "./components/shared/AdminModal";
import { Toast, Footer } from "./components/shared/UI";

import Landing     from "./pages/Landing";
import PatientAuth from "./pages/PatientAuth";
import ClinicAuth  from "./pages/ClinicAuth";
import PatientDash from "./pages/PatientDash";
import ClinicDash  from "./pages/ClinicDash";
import DoctorDash  from "./pages/DoctorDash";
import AdminDash   from "./pages/AdminDash";
import PasswordReset from "./pages/PasswordReset";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationNotice from "./pages/VerificationNotice";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

// ── Auth bridge: injects Clinic & Appointment setters into AuthProvider ──
function AuthBridge({ showToast, children }) {
  const { setClinics, setPending, setSpecialties } = useClinic();
  const { setAppts }               = useAppointment();

  return (
    <AuthProvider showToast={showToast} setClinics={setClinics} setPending={setPending} setAppts={setAppts} setSpecialties={setSpecialties}>
      {children}
    </AuthProvider>
  );
}

// ── Page router — consumes all contexts ──────────────────────────
function AppRoutes() {
  const {
    session,
    adminModalOpen, setAdmMod,
    goHome, logout,
    handlePatAuth, handleClinicAuth, handleAdminSuccess,
  } = useAuth();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <>
      {(!!session.role || location.pathname === "/patient/dashboard") && <Navbar session={session} onHome={goHome} onLogout={logout} theme={theme} />}
      
      <button 
        onClick={toggleTheme} 
        style={{ 
          position: "fixed", 
          bottom: 24, 
          left: 24, 
          zIndex: 9999, 
          background: theme === "light" ? "#000" : "#fff", 
          color: theme === "light" ? "#fff" : "#000", 
          border: `1px solid ${theme === "light" ? "#444" : "#ddd"}`, 
          padding: "6px 12px", 
          borderRadius: 16, 
          cursor: "pointer", 
          fontWeight: 700, 
          fontSize: ".75rem", 
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", 
          transition: "all .3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          textTransform: "uppercase",
          letterSpacing: "0.03em"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
        }}
      >
        {theme === "light" ? "Dark Mode" : "Light Mode"}
      </button>

      <AdminModal
        open={adminModalOpen}
        onClose={() => setAdmMod(false)}
        onSuccess={handleAdminSuccess}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/" element={
            session.role ? (
              !session.isEmailVerified && session.role !== "admin" ? <Navigate to="/verify-notice" /> :
              <Navigate to={session.role === "patient" ? "/patient/dashboard" : session.role === "doctor" ? "/doctor/dashboard" : session.role === "clinic" ? "/clinic/dashboard" : "/admin/dashboard"} />
            ) :
            <Landing onRole={(r) => r === "patient" ? navigate("/patient/dashboard") : navigate("/clinic/auth")} onAdminClick={() => setAdmMod(true)} />
          } />

          <Route path="/patient/auth" element={
            session.role ? <Navigate to="/" /> :
            <PatientAuth onBack={() => navigate("/patient/dashboard")} onLogin={handlePatAuth} />
          } />

          <Route path="/clinic/auth" element={
            session.role ? <Navigate to="/" /> :
            <ClinicAuth onBack={() => navigate("/")} onLogin={handleClinicAuth} />
          } />

          <Route path="/patient/dashboard" element={
            (session.role === "clinic" || session.role === "admin") ? <Navigate to="/" /> :
            (session.role && !session.isEmailVerified) ? <Navigate to="/verify-notice" /> :
            <PatientDash isGuest={!session.role} />
          } />

          <Route path="/clinic/dashboard" element={
            session.role !== "clinic" ? <Navigate to="/" /> :
            !session.isEmailVerified ? <Navigate to="/verify-notice" /> :
            <ClinicDash theme={theme} />
          } />

          <Route path="/doctor/dashboard" element={
            session.role !== "doctor" ? <Navigate to="/" /> :
            !session.isEmailVerified ? <Navigate to="/verify-notice" /> :
            <DoctorDash theme={theme} />
          } />

          <Route path="/admin/dashboard" element={
            session.role !== "admin" ? <Navigate to="/" /> :
            <AdminDash />
          } />

          <Route path="/reset-password" element={<PasswordReset />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-notice" element={session.role && !session.isEmailVerified ? <VerificationNotice /> : <Navigate to="/" />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      <Footer />
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────
export default function App() {
  const { toast, showToast } = useToast();

  return (
    <div style={s.page}>
      <Toast msg={toast?.msg} type={toast?.type} />

      <ClinicProvider showToast={showToast}>
        <AppointmentProvider showToast={showToast}>
          <AuthBridge showToast={showToast}>
            <AppRoutes />
          </AuthBridge>
        </AppointmentProvider>
      </ClinicProvider>
    </div>
  );
}
