import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "mov30444@gmail.com";
const ADMIN_PASS  = import.meta.env.VITE_ADMIN_PASS  || "admin1234";
import { loadAppts } from "../utils/appointmentHelpers";
import {
  patientRegister, patientLogin,
  clinicRegister,  clinicLogin,
  doctorLogin,
  adminLogin,      getAllClinics,
  getSpecialties,  getMyProfile,
} from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children, showToast, setClinics, setPending, setAppts, setSpecialties }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [session, setSession] = useState(() => {
    const s = localStorage.getItem("session");
    return s ? JSON.parse(s) : { role: null, email: null, name: null };
  });
  const navigate = useNavigate();
  
  const [loggedInClinic, setLogClinic] = useState(() => {
    const c = localStorage.getItem("loggedInClinic");
    return c ? JSON.parse(c) : null;
  });

  const [adminModalOpen, setAdminModalOpen]  = useState(false);
  const hasValidatedToken = useRef(false);

  // ── Sync appts/metadata on mount if session exists ─────────────────
  useEffect(() => {
    if (!token || !session.role || hasValidatedToken.current) return;
    hasValidatedToken.current = true;

    // Validate the token is still valid by making a lightweight API call
    const validateAndLoad = async () => {
      try {
        // For clinic role, re-fetch fresh profile data from the server
        if (session.role === "clinic") {
          try {
            const freshProfile = await getMyProfile("clinic", token);
            if (freshProfile) {
              const freshClinic = { _id: freshProfile.id || session._id, ...freshProfile };
              setLogClinic(freshClinic);
              localStorage.setItem("loggedInClinic", JSON.stringify(freshClinic));
            }
          } catch (err) {
            // If 401, token is expired — auto logout
            if (err.message?.includes("Not authorised") || err.message?.includes("Token invalid")) {
              console.warn("Session expired on refresh — logging out.");
              handleExpiredSession();
              return;
            }
          }
        }

        // Validate token by loading appointments
        await loadAppts(session.role, token, setAppts);

        if (session.role === "admin") {
          getSpecialties().then(s => setSpecialties(s || [])).catch(()=>{});
          getAllClinics(token).then(all => {
            const arr = Array.isArray(all) ? all : [];
            setPending(arr.filter(c => c.status === "pending"));
            setClinics(arr.filter(c => c.status !== "pending"));
          }).catch(()=>{});
        }
      } catch (err) {
        // If any API call returns 401/auth error, the token is invalid
        if (err.message?.includes("Not authorised") || err.message?.includes("Token invalid")) {
          console.warn("Session expired on refresh — logging out.");
          handleExpiredSession();
        }
      }
    };

    validateAndLoad();
  }, []); // Run once on mount if data exists from lazy init

  // ── Handle expired session gracefully ──────────────────────────────
  const handleExpiredSession = useCallback(() => {
    setSession({ role: null, email: null, name: null });
    setToken(null);
    setLogClinic(null);
    setAppts([]);
    localStorage.removeItem("token");
    localStorage.removeItem("session");
    localStorage.removeItem("loggedInClinic");
    navigate("/");
    showToast("Your session has expired. Please sign in again.", true);
  }, [showToast, setAppts, navigate]);

  const navigateToHome = useCallback(() => {
    const map = { patient: "/patient/dashboard", doctor: "/doctor/dashboard", clinic: "/clinic/dashboard", admin: "/admin/dashboard" };
    navigate(map[session.role] || "/");
  }, [session.role, navigate]);

  const logout = useCallback(() => {
    setSession({ role: null, email: null, name: null });
    setToken(null);
    setLogClinic(null);
    setAppts([]);
    localStorage.removeItem("token");
    localStorage.removeItem("session");
    localStorage.removeItem("loggedInClinic");
    navigate("/");
    showToast("Signed out successfully.");
  }, [showToast, setAppts, navigate]);

  const handlePatientAuthentication = useCallback(async ({ type, email, pass, fname, lname, phone }) => {
    if (type === "register") {
      if (!fname || !lname || !email || !pass) { showToast("Please fill all fields.", true); return; }
      if (pass.length < 8) { showToast("Password must be at least 8 characters.", true); return; }
      try {
        const res = await patientRegister({ firstName: fname, lastName: lname, email, phone, password: pass });
        const sess = { _id: res.user.id, role: "patient", email, name: `${fname} ${lname}` };
        setToken(res.token);
        setSession(sess);
        localStorage.setItem("token", res.token);
        localStorage.setItem("session", JSON.stringify(sess));
        navigate("/patient/dashboard");
        showToast(`Account created! Welcome, ${fname}!`);
      } catch (err) {
        showToast(err.message || "Registration failed", true);
      }
    } else {
      if (!email || !pass) { showToast("Please enter your email and password.", true); return; }
      try {
        const res = await patientLogin(email, pass);
        const sess = { _id: res.user.id, role: "patient", email: res.user.email, name: res.user.name, isEmailVerified: res.user.isEmailVerified };
        setToken(res.token);
        setSession(sess);
        localStorage.setItem("token", res.token);
        localStorage.setItem("session", JSON.stringify(sess));
        loadAppts("patient", res.token, setAppts);
        navigate("/patient/dashboard");
        showToast(`Welcome back, ${res.user.name.split(" ")[0]}!`);
      } catch (err) {
        showToast(err.message || "No account found or incorrect password.", true);
      }
    }
  }, [showToast, setAppts, navigate]);

  const handleDoctorAuth = useCallback(async (email, pass) => {
    if (!email || !pass) { showToast("Please enter email and password.", true); return; }
    try {
      const res = await doctorLogin(email, pass);
      const sess = { _id: res.user.id, role: "doctor", email: res.user.email, name: res.user.name, clinicId: res.user.clinicId, isEmailVerified: res.user.isEmailVerified };
      setToken(res.token);
      setSession(sess);
      localStorage.setItem("token", res.token);
      localStorage.setItem("session", JSON.stringify(sess));
      loadAppts("doctor", res.token, setAppts);
      navigate("/doctor/dashboard");
      showToast(`Welcome, ${res.user.name}!`);
    } catch (err) {
      showToast(err.message || "Incorrect doctor credentials.", true);
    }
  }, [showToast, setAppts, navigate]);

  const handleClinicAuthentication = useCallback(async (data) => {
    if (data.type === "clinicLogin") {
      const { email, pass } = data;
      if (!email) { showToast("Please enter your email.", true); return; }
      if (email === ADMIN_EMAIL && pass === ADMIN_PASS) { handleAdminSuccess(); return; }
      try {
        const res = await clinicLogin(email, pass);
        const sess = { _id: res.user.id, role: "clinic", email: res.user.email, name: res.user.name, isEmailVerified: res.user.isEmailVerified };
        setToken(res.token);
        setLogClinic(res.user);
        setSession(sess);
        localStorage.setItem("token", res.token);
        localStorage.setItem("session", JSON.stringify(sess));
        localStorage.setItem("loggedInClinic", JSON.stringify(res.user));
        loadAppts("clinic", res.token, setAppts);
        navigate("/clinic/dashboard");
        showToast(`Welcome, ${res.user.name}!`);
      } catch (err) {
        showToast(err.message || "Email not found or incorrect password.", true);
      }
    } else if (data.type === "doctorLogin") {
      const { email, pass } = data;
      await handleDoctorAuth(email, pass);
    } else {
      const { name, email, phone, pass, pass2, address, city, state, documents, description, lat, lng } = data;
      if (!name || !email || !address || !city || !state || !pass) {
        showToast("Please fill all required fields.", true); return;
      }
      if (pass !== pass2) { showToast("Passwords do not match!", true); return; }

      try {
        const res = await clinicRegister({
          name, email, phone, address, city, state, documents, description,
          location: { lat: lat || 0, lng: lng || 0 }, password: pass
        });
        const sess = { _id: res.user.id, role: "clinic", email: res.user.email, name: res.user.name, isEmailVerified: res.user.isEmailVerified };
        const newClinic = { _id: res.user.id, ...res.user, isEmailVerified: res.user.isEmailVerified };
        setToken(res.token);
        setPending(prev => [...prev, newClinic]);
        setLogClinic(newClinic);
        setSession(sess);
        localStorage.setItem("token", res.token);
        localStorage.setItem("session", JSON.stringify(sess));
        localStorage.setItem("loggedInClinic", JSON.stringify(newClinic));
        navigate("/clinic/dashboard");
        showToast("Application submitted! Awaiting admin verification.");
      } catch (err) {
        showToast(err.message || "Registration failed", true);
      }
    }
  }, [showToast, setAppts, setPending, navigate, handleDoctorAuth]);

  const handleAdminSuccess = useCallback(async () => {
    try {
      const res = await adminLogin(ADMIN_EMAIL, ADMIN_PASS);
      const sess = { _id: "admin", role: "admin", email: ADMIN_EMAIL, name: "Admin" };
      setToken(res.token);
      setSession(sess);
      localStorage.setItem("token", res.token);
      localStorage.setItem("session", JSON.stringify(sess));
      
      const specs = await getSpecialties();
      setSpecialties(specs || []);
      const allRes = await getAllClinics(res.token);
      const clinicsArray = Array.isArray(allRes) ? allRes : [];
      setPending(clinicsArray.filter(c => c.status === "pending"));
      setClinics(clinicsArray.filter(c => c.status !== "pending"));
      loadAppts("admin", res.token, setAppts);
      
      setAdminModalOpen(false);
      navigate("/admin/dashboard");
      showToast("Admin signed in.");
    } catch (err) {
      showToast(err.message || "Admin sign in failed", true);
    }
  }, [showToast, setPending, setClinics, setAppts, setSpecialties, navigate]);
  
  const refreshProfile = useCallback(async () => {
    if (!token || !session.role) return;
    try {
      const freshProf = await getMyProfile(session.role, token);
      if (freshProf) {
        // Update session
        const newSess = { ...session, isEmailVerified: freshProf.isEmailVerified };
        setSession(newSess);
        localStorage.setItem("session", JSON.stringify(newSess));

        // Update clinic specific state if needed
        if (session.role === "clinic") {
          const freshClinic = { _id: freshProf.id || session._id, ...freshProf };
          setLogClinic(freshClinic);
          localStorage.setItem("loggedInClinic", JSON.stringify(freshClinic));
        }
      }
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  }, [token, session]);

  const value = {
    session, token, setToken, showToast,
    loggedInClinic, setLogClinic, adminModalOpen, setAdminModalOpen,
    navigateToHome, logout, handlePatientAuthentication, handleClinicAuthentication, handleDoctorAuth, handleAdminSuccess,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
