import { useState, useEffect, useRef, useCallback } from "react";
import s from "../constants/styles";
import C from "../constants/colors";
import useResponsive from "../hooks/useResponsive";
import { useAuth } from "../context/AuthContext";
import { useAppointment } from "../context/AppointmentContext";
import VerificationNotice from "./VerificationNotice";
import { searchClinics, getSearchSuggestions, getClinicDetails, getDoctorsByClinicSpecialty, createAppointment, getBookedSlots, getSpecialties, changePassword, updatePatientProfile, getMyProfile, createRazorpayOrder, verifyPayment, rescheduleAppointment } from "../services/api";
import { Inp, Btn, Bdg, TabBtns } from "../components/shared/UI";
import PaymentModal from "../components/shared/PaymentModal";
import SupportModal, { SupportFAB } from "../components/shared/SupportModal";
import { getSocket, joinRoom, leaveRoom } from "../services/socket";
import CalendarPicker from "../components/shared/CalendarPicker";
import { useSearchParams, useNavigate } from "react-router-dom";
import { formatSlotRange } from "../utils/timeUtils";


function calculateSlotsOnDate(doc, dateStr) {
  if (!doc || !dateStr) return 0;

  // If the doctor is marked unavailable until a future date, return 0 for dates BEFORE the return date.
  // unavailableUntil is the return date, so the doctor IS available ON that date.
  if (doc.unavailableUntil) {
    const unavailStr = doc.unavailableUntil.split("T")[0]; // normalize to YYYY-MM-DD
    if (dateStr < unavailStr) return 0;
  }

  const dur = Number(doc.slotDuration) || 30;
  
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  // Cutoff check
  if (doc.tomorrowBookingCutoffTime) {
    const cutoffMins = parseSlotMinutes(doc.tomorrowBookingCutoffTime);
    const isSameDayCutoff = doc.bookingCutoffDay === "same_day";
    const apptDateObj = new Date(dateStr);
    
    // Calculate the deadline date (the day on or before which you must book)
    const deadlineDateObj = new Date(apptDateObj);
    if (!isSameDayCutoff) deadlineDateObj.setDate(deadlineDateObj.getDate() - 1);
    const deadlineDateStr = `${deadlineDateObj.getFullYear()}-${String(deadlineDateObj.getMonth() + 1).padStart(2, "0")}-${String(deadlineDateObj.getDate()).padStart(2, "0")}`;
    
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (todayStr > deadlineDateStr) return 0;
    if (todayStr === deadlineDateStr && nowMins > cutoffMins) return 0;
  }

  const offsetMins = doc.slotBookingOffset ? parseSlotMinutes(doc.slotBookingOffset) : 0;
  const nowMinsTotal = now.getHours() * 60 + now.getMinutes();
  
  let total = 0;
  const ranges = [
    { s: doc.morningActive !== false ? doc.morningStartTime : null, e: doc.morningActive !== false ? doc.morningEndTime : null },
    { s: doc.afternoonActive !== false ? doc.afternoonStartTime : null, e: doc.afternoonActive !== false ? doc.afternoonEndTime : null },
    { s: doc.eveningActive !== false ? doc.eveningStartTime : null, e: doc.eveningActive !== false ? doc.eveningEndTime : null },
    { s: doc.nightActive !== false ? doc.nightStartTime : null, e: doc.nightActive !== false ? doc.nightEndTime : null }
  ];

  ranges.forEach(r => {
    if (!r.s || !r.e) return;
    const startMins = parseSlotMinutes(r.s);
    const endMins = parseSlotMinutes(r.e);
    let current = startMins;
    while (current + dur <= endMins) {
      if (dateStr === todayStr) {
        if (current > (nowMinsTotal + offsetMins)) total++;
      } else {
        total++;
      }
      current += dur;
    }
  });
  return total;
}

function calculateSlotsToday(doc) {
  if (!doc) return 0;
  // If doctor is unavailable, return 0 immediately
  if (doc.unavailableUntil) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const unavailStr = doc.unavailableUntil.split("T")[0];
    if (todayStr < unavailStr) return 0;
  }
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return calculateSlotsOnDate(doc, todayStr);
}

function parseSlotMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(/[: ]/);
  let h = parseInt(parts[0], 10) || 0;
  let m = parseInt(parts[1], 10) || 0;
  const mer = parts[2] ? parts[2].toUpperCase() : null;
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function generateSlotsInRange(startTimeStr, endTimeStr, durationMinutes) {
  if (!startTimeStr || !endTimeStr || !durationMinutes) return [];
  const slots = [];
  let startMins = parseSlotMinutes(startTimeStr);
  let endMins = parseSlotMinutes(endTimeStr);

  // Fallback if end time is incorrectly earlier than start time (e.g. 12:00 AM instead of PM)
  if (startMins >= endMins && startMins > 0) {
      if (endMins < 12 * 60) endMins += 12 * 60; // Auto-correct 12h overlap issues
  }

  while (startMins + durationMinutes <= endMins) {
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    const isPM = h >= 12;
    const displayH = h % 12 || 12;
    const mm = String(m).padStart(2, "0");
    const id = `${String(h % 24).padStart(2, "0")}:${mm}`;
    
    const endMinutes = startMins + durationMinutes;
    const eh = Math.floor(endMinutes / 60);
    const em = endMinutes % 60;
    const isEPM = eh >= 12;
    const displayEH = eh % 12 || 12;
    const emm = String(em).padStart(2, "0");
    
    const endStr = `${String(eh % 24).padStart(2, "0")}:${emm}`;

    slots.push({
      id,
      start: id,
      end: endStr,
      label: `${String(displayH).padStart(2, "0")}:${mm} ${isPM ? "PM" : "AM"} - ${String(displayEH).padStart(2, "0")}:${emm} ${isEPM ? "PM" : "AM"}`
    });
    startMins += durationMinutes;
  }
  return slots;
}

function AnimCard({ children, style = {}, delay = 0, onClick, hoverable = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 8,
        padding: 22,
        transition: "all .2s ease",
        animation: `fadeSlideUp .3s ${delay}s both`,
        cursor: hoverable || onClick ? "pointer" : "default",
        ...(hoverable && hovered ? { borderColor: C.blue, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  const R = useResponsive();
  return (
    <div style={{
      background: C.white,
      borderRadius: 8,
      padding: R.isMobile ? "12px 8px" : "16px 20px",
      border: `1px solid ${C.gray200}`,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      minHeight: R.isMobile ? 80 : 90
    }}>
      <div style={{ fontSize: R.isMobile ? "1.2rem" : "1.4rem", fontWeight: 800, color: C.blue }}>{value}</div>
      <div style={{ fontSize: R.isMobile ? ".65rem" : ".76rem", color: C.gray500, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 24, animation: "fadeSlideUp .3s both" }}>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: C.gray900 }}>{title}</h2>
      {sub && <p style={{ color: C.gray500, fontSize: ".86rem", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function BookingProgress({ view }) {
  const R = useResponsive();
  const steps = [
    { id: "search", label: "Select Clinic" },
    { id: "clinic", label: "Specialty" },
    { id: "specialty", label: "Select Doctor" },
    { id: "book", label: "Book" }
  ];

  const currentIdx = steps.findIndex(s => s.id === view || (s.id === "specialty" && view === "doctor_profile"));

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      marginBottom: 32, 
      gap: R.isMobile ? "12px 6px" : "20px 10px", 
      flexWrap: "wrap", 
      animation: "fadeSlideUp .3s both" 
    }}>
      {steps.map((s, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: R.isMobile ? 4 : 8 }}>
            <div style={{ 
              width: R.isMobile ? (isActive ? 22 : 18) : (isActive ? 26 : 20), 
              height: R.isMobile ? (isActive ? 22 : 18) : (isActive ? 26 : 20), 
              borderRadius: "50%", 
              display: "flex", alignItems: "center", justifyContent: "center", 
              fontSize: R.isMobile ? ".6rem" : ".75rem", fontWeight: 800,
              background: isActive ? "#14b8a6" : isDone ? "#14b8a6" : "#e2e8f0",
              color: isActive ? "#042f2e" : isDone ? "#042f2e" : "#64748b",
              border: isActive ? `2px solid #042f2e` : isDone ? "none" : `1px solid #cbd5e1`,
              boxShadow: isActive ? "0 0 12px rgba(20, 184, 166, 0.3)" : "none",
              transition: "all .3s ease",
              zIndex: isActive ? 2 : 1
            }}>
              {i + 1}
            </div>
            {!R.isMobile || isActive ? (
              <span style={{ 
                fontSize: R.isMobile ? ".68rem" : ".76rem", 
                fontWeight: isActive ? 800 : 700, 
                color: isActive || isDone ? "#14b8a6" : "#64748b",
                marginLeft: 4
              }}>{s.label}</span>
            ) : null}
            {i < steps.length - 1 && (
              <div style={{ 
                width: R.isMobile ? 12 : 24, 
                height: 2.5, 
                background: i < currentIdx ? "#14b8a6" : "#e2e8f0", 
                margin: "0 4px",
                borderRadius: 2
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PatientDash({ isGuest }) {
  const { appointments, setAppts, bookAppt, cancelAppt, refreshAppts, initSocketListeners } = useAppointment();
  const { session, token, logout, refreshProfile } = useAuth();
  const R = useResponsive();

  // Guard for email verification (patients only)
  if (session?.role === "patient" && !session?.isEmailVerified) {
    return (
      <>
        <VerificationNotice />
        <SupportFAB onClick={() => setSupportModalOpen(true)} />
        <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} token={token} />
      </>
    );
  }

  // Helper for restoring state
  const getPending = () => {
    const p = sessionStorage.getItem("pendingBooking");
    if (!p) return null;
    try { return JSON.parse(p); } catch { return null; }
  };

  const getActiveFlow = () => {
    const f = sessionStorage.getItem("activePatientFlow");
    if (!f) return null;
    try { return JSON.parse(f); } catch { return null; }
  };

  // Guard: If not a guest and session isn't loaded yet, show a loading state instead of crashing
  if (!isGuest && !session?.role) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.gray50 }}>
        <p style={{ fontWeight: 700, color: C.gray500 }}>Loading Dashboard...</p>
        <SupportFAB onClick={() => setSupportModalOpen(true)} />
        <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} token={token} />
      </div>
    );
  }

  // Guard: If authenticated but role isn't patient, redirect away
  if (session?.role && session.role !== "patient") {
    // We use a timeout to avoid react update warnings if triggered during render
    setTimeout(() => {
      if (session.role === "clinic") navigate("/clinic/dashboard");
      else if (session.role === "admin") navigate("/admin/dashboard");
    }, 0);
    return null;
  }

  const formatTime12 = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    let hh = parseInt(h);
    const mmm = m || "00";
    const mer = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    return `${hh}:${mmm} ${mer}`;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [internalTab, setInternalTab] = useState(() => searchParams.get("tab") || "Search Clinics");

  const initialData = (!isGuest ? getPending() : null) || getActiveFlow() || null;

  const [view, setView] = useState(() => {
    if (initialData && initialData.view) return initialData.view;
    const v = searchParams.get("view");
    // If the view requires selectedClinic but we just mounted (so it's null), fallback to search
    if (v === "book" || v === "specialty" || v === "clinic" || v === "doctor_profile") return "search";
    return v || "search";
  });

  // Sync state with URL params when they change (e.g. back button)
  useEffect(() => {
    const pTab = searchParams.get("tab") || "Search Clinics";
    const pView = searchParams.get("view") || "search";
    
    if (pTab !== internalTab) setInternalTab(pTab);
    if (pView !== view) {
      if ((pView === "book" || pView === "specialty" || pView === "clinic" || pView === "doctor_profile") && !selectedClinicRef.current) {
         // Prevent broken views on back
         setSearchParams({ tab: "Search Clinics", view: "search" }, { replace: true });
         setView("search");
      } else {
         setView(pView);
      }
    }
  }, [searchParams]);

  // Unified navigation that pushes to React Router history
  const navigateInternal = (newTab, newView, replace = false) => {
    const t = newTab || internalTab;
    const v = newView || view;

    if (newTab) setInternalTab(newTab);
    if (newView) setView(newView);
    
    setSearchParams({ tab: t, view: v }, { replace });
  };

  const setTab = (newTab) => navigateInternal(newTab, "search");
  const updateView = (newView) => navigateInternal(null, newView);

  // Ref to track whether we restored from pendingBooking (used by popstate guard)
  const restoredFromPendingRef = useRef(false);
  // Ref to track selectedClinic for popstate handler (avoids stale closure)
  const selectedClinicRef = useRef(null);

  const tab = internalTab;
  const [specialtyMeta, setSpecialtyMeta] = useState([]);

  const [query, setQuery] = useState("");
  const [clinicResults, setClinicResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);
  const cacheRef = useRef({}); // Cache for suggestions

  // Debounced suggestion fetch with caching
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    
    // Check cache first for instant results
    if (cacheRef.current[lowerQuery]) {
      setSuggestions(cacheRef.current[lowerQuery]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await getSearchSuggestions(query);
        cacheRef.current[lowerQuery] = res; // Store in cache
        setSuggestions(res);
      } catch (err) { console.error("Suggestions error:", err); }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const [reason, setReason] = useState("");
  const [payModalOpen, setPayModal] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const [selectedClinic, setSelectedClinic] = useState(() => initialData?.selectedClinic || null);
  // Keep ref in sync for popstate handler
  useEffect(() => { selectedClinicRef.current = selectedClinic; }, [selectedClinic]);
  const [clinicSpecialties, setClinicSpecialties] = useState(() => initialData?.clinicSpecialties || []);
  const [selectedSpecialty, setSelectedSpecialty] = useState(() => initialData?.selectedSpecialty || null);
  const [doctors, setDoctors] = useState(() => initialData?.doctors || []);
  const [selectedDoc, setSelectedDoc] = useState(() => initialData?.selectedDoc || null);
  const [date, setDate] = useState(() => initialData?.date || "");
  const [time, setTime] = useState(() => initialData?.time || "");
  const [bookedSlots, setBookedSlots] = useState(() => initialData?.bookedSlots || []);

  const [bookingName, setBookingName] = useState(() => initialData?.bookingName || "");
  const [bookingPhone, setBookingPhone] = useState(() => initialData?.bookingPhone || "");
  const [bookingAge, setBookingAge] = useState(() => initialData?.bookingAge || "");
  const [bookingAddress, setBookingAddress] = useState(() => initialData?.bookingAddress || "");
  const [bookingGender, setBookingGender] = useState(() => initialData?.bookingGender || "Male");
  
  // Persist flow on change so F5 refresh doesn't drop the user's booking selection
  useEffect(() => {
    sessionStorage.setItem("activePatientFlow", JSON.stringify({
      view, selectedClinic, clinicSpecialties, selectedSpecialty, 
      doctors, selectedDoc, date, time, bookedSlots,
      bookingName, bookingPhone, bookingAge, bookingAddress, bookingGender
    }));
  }, [view, selectedClinic, clinicSpecialties, selectedSpecialty, doctors, selectedDoc, date, time, bookedSlots, bookingName, bookingPhone, bookingAge, bookingAddress, bookingGender]);
  const [apptHistoryFilter, setApptHistoryFilter] = useState("All");

  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleActiveShift, setRescheduleActiveShift] = useState("morning");
  const [rescheduleSelectedHourRange, setRescheduleSelectedHourRange] = useState(null);
  const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Persistence logic: handles alerts, cleanup, and history stack repair after login
  useEffect(() => {
    if (!isGuest && session?.role === "patient") { // Ensure session is fully loaded
      const pending = sessionStorage.getItem("pendingBooking");
      const redirect = sessionStorage.getItem("authRedirect");
      
      if (pending) {
          sessionStorage.removeItem("pendingBooking");
          sessionStorage.removeItem("authRedirect");
          restoredFromPendingRef.current = true;
          // Clean the browser history stack via React Router
          setSearchParams({ tab: "Search Clinics", view: "book" }, { replace: true });
          showMsg(`Welcome back, ${session?.name?.split(" ")?.[0] || "Patient"}! Resuming your booking.`);
      } else if (redirect) {
          sessionStorage.removeItem("authRedirect");
          if (redirect === "appointments") {
            setSearchParams({ tab: "My Appointments", view: "search" }, { replace: true });
          } else {
            setSearchParams({ tab: "Search Clinics", view: "search" }, { replace: true });
          }
      }
    }
  }, [isGuest, session?.name, session?.role]);

  const [toast, setToast] = useState("");

  // Settings state
  const [profFirstName, setProfFirstName] = useState("");
  const [profLastName, setProfLastName] = useState("");

  const [profEmail, setProfEmail] = useState("");
  const [profLoading, setProfLoading] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    getSpecialties().then(res => setSpecialtyMeta(Array.isArray(res) ? res : [])).catch(() => {});
    if (token) {
      refreshAppts("patient", token).catch(() => {});
    }
    if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [token, refreshAppts]);

  // Separate useEffect for socket listeners so cleanup runs correctly
  useEffect(() => {
    if (token && session?._id) {
      const cleanup = initSocketListeners("patient", session._id, token);
      return cleanup;
    }
  }, [token, session?._id, initSocketListeners]);

  // Real-time slot listener
  useEffect(() => {
    if (!selectedDoc || !date) return;
    const room = `doctor-slots:${selectedDoc._id}:${date}`;
    joinRoom(room);
    
    const socket = getSocket();
    
    const handleSlotBooked = ({ time }) => {
      setBookedSlots(prev => {
        if (!prev.includes(time)) return [...prev, time];
        return prev;
      });
      showMsg("A slot was just booked by someone else!");
    };

    const handleSlotFreed = ({ time }) => {
      setBookedSlots(prev => prev.filter(t => t !== time));
    };

    socket.on("slot-booked", handleSlotBooked);
    socket.on("slot-freed", handleSlotFreed);

    return () => {
      socket.off("slot-booked", handleSlotBooked);
      socket.off("slot-freed", handleSlotFreed);
      leaveRoom(room);
    };
  }, [selectedDoc, date]);


  const showMsg = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };

  const handleSearch = async (overrideQuery) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    setLoading(true);
    try {
      const res = await searchClinics(q, "");
      setClinicResults(res);
    } catch { showMsg("Error searching clinics"); }
    setLoading(false);
  };

  const handleSelectClinic = async (id) => {
    setShowSuggestions(false);
    try {
      const res = await getClinicDetails(id);
      setSelectedClinic(res.clinic);
      setClinicSpecialties(res.specialties || []);
      updateView("clinic");
    } catch { showMsg("Error loading clinic details"); }
  };

  const handleSelectSuggestion = async (s) => {
    setShowSuggestions(false);
    if (s.type === "location") {
      setQuery(s.text);
      handleSearch(s.text);
    } else if (s.type === "clinic") {
      handleSelectClinic(s.id);
    } else if (s.type === "doctor") {
      // Navigate to clinic then specialty (Select Doctor stage)
      try {
        const res = await getClinicDetails(s.clinicId);
        setSelectedClinic(res.clinic);
        setClinicSpecialties(res.specialties || []);
        
        const drs = await getDoctorsByClinicSpecialty(s.clinicId, s.specialty);
        setSelectedSpecialty(s.specialty);
        setDoctors(drs);
        
        // Use Stage 3: Select Doctor
        updateView("specialty");
      } catch (err) {
        console.error("Doctor suggestion error:", err);
        showMsg("Error loading doctor details");
      }
    }
  };

  const handleSelectSpecialty = async (spec) => {
    try {
      const res = await getDoctorsByClinicSpecialty(selectedClinic._id, spec);
      setSelectedSpecialty(spec);
      setDoctors(res);
      updateView("specialty");
    } catch { showMsg("Error loading doctors"); }
  };

  const handleSelectDoc = (doc) => {
    if (isGuest) {
      sessionStorage.setItem("pendingBooking", JSON.stringify({ 
        selectedClinic, 
        selectedSpecialty, 
        selectedDoc: doc, 
        view: "book" 
      }));
      navigate("/patient/auth");
      return;
    }
    setSelectedDoc(doc);
    setDate("");
    setTime("");
    setBookedSlots([]);
    setBookingName(session?.name || "");
    setBookingPhone(session?.phone || "");
    setBookingAge(session?.age || "");
    setBookingAddress(session?.address || "");
    updateView("book");
  };

  const handleDateChange = async (d) => {
    setDate(d);
    setTime("");
    try {
      const booked = await getBookedSlots(selectedDoc._id, d);
      setBookedSlots(Array.isArray(booked) ? booked : []);
    } catch { setBookedSlots([]); }
  };


  const getLocalDayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = getLocalDayStr();
  const maxDate = getLocalDayStr(new Date(Date.now() + (selectedClinic?.maxBookingDays || 7) * 24 * 60 * 60 * 1000));
  const nowMinutes = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const [activeShift, setActiveShift] = useState("morning");
  const [selectedHourRange, setSelectedHourRange] = useState(null);
  const slotsDetailRef = useRef(null);

  const handleShiftChange = (shift) => {
    setActiveShift(shift);
    setSelectedHourRange(null);
  };

  useEffect(() => {
    if (selectedHourRange && slotsDetailRef.current) {
      const el = slotsDetailRef.current;
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      setTimeout(() => window.scrollTo({ top, behavior: "smooth" }), 50);
    }
  }, [selectedHourRange]);

  useEffect(() => {
    if (time && formRef.current) {
      const el = formRef.current;
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      setTimeout(() => window.scrollTo({ top, behavior: "smooth" }), 100);
    }
  }, [time]);

  const availableSlots = (() => {
    try {
      if (!selectedDoc) return { morning: [], afternoon: [], evening: [], night: [] };
      const duration = Number(selectedDoc.slotDuration) || 30;

      const isCutoffExceeded = (() => {
        if (!selectedDoc.tomorrowBookingCutoffTime || !date) return false;
        const cutoffMins = parseSlotMinutes(selectedDoc.tomorrowBookingCutoffTime);
        const isSameDayCutoff = selectedDoc.bookingCutoffDay === "same_day";
        const apptDateObj = new Date(date);
        if (isNaN(apptDateObj.getTime())) return false;
        if (!isSameDayCutoff) apptDateObj.setDate(apptDateObj.getDate() - 1);
        const deadlineDateStr = getLocalDayStr(apptDateObj);
        if (today > deadlineDateStr) return true;
        if (today === deadlineDateStr) return nowMinutes > cutoffMins;
        return false;
      })();

      const filterFn = (s) => {
        if (bookedSlots.includes(s.start)) return false;
        const slotMins = parseSlotMinutes(s.start);
        const offsetMins = selectedDoc.slotBookingOffset ? parseSlotMinutes(selectedDoc.slotBookingOffset) : 0;
        if (date === today) return slotMins > (nowMinutes + offsetMins);
        if (isCutoffExceeded) return false;
        return true;
      };

      const categorized = { morning: [], afternoon: [], evening: [], night: [] };
      const allRanges = [
        { key: 'morning', start: selectedDoc.morningActive !== false ? selectedDoc.morningStartTime || "08:00" : null, end: selectedDoc.morningActive !== false ? selectedDoc.morningEndTime || "12:00" : null },
        { key: 'afternoon', start: selectedDoc.afternoonActive !== false ? selectedDoc.afternoonStartTime || "12:00" : null, end: selectedDoc.afternoonActive !== false ? selectedDoc.afternoonEndTime || "16:00" : null },
        { key: 'evening', start: selectedDoc.eveningActive !== false ? selectedDoc.eveningStartTime || "16:00" : null, end: selectedDoc.eveningActive !== false ? selectedDoc.eveningEndTime || "20:00" : null },
        { key: 'night', start: selectedDoc.nightActive !== false ? selectedDoc.nightStartTime || "20:00" : null, end: selectedDoc.nightActive !== false ? selectedDoc.nightEndTime || "23:59" : null },
      ];

      allRanges.forEach(r => {
        if (!r.start || !r.end) return;
        const slots = generateSlotsInRange(r.start, r.end, duration);
        categorized[r.key] = slots.filter(filterFn);
      });

      if (isCutoffExceeded && selectedDoc.tomorrowBookingCutoffTime) {
         const fmt12h = (t) => {
           const parts = t.split(":");
           let h = parseInt(parts[0], 10);
           const m = parts[1] || "00";
           const mer = h >= 12 ? "PM" : "AM";
           h = h % 12 || 12;
           return `${String(h).padStart(2, "0")}:${m} ${mer}`;
         };
         const dayStr = selectedDoc.bookingCutoffDay === "same_day" ? "on the day of the appointment" : "the day before the appointment";
         categorized._cutoffMessage = `Bookings for this date closed at ${fmt12h(selectedDoc.tomorrowBookingCutoffTime)} ${dayStr}.`;
      }
      return categorized;
    } catch (e) {
      console.error("availableSlots error:", e);
      return { morning: [], afternoon: [], evening: [], night: [] };
    }
  })();

  const handleRescheduleSuccess = useCallback(async (apptId, details) => {
    setRescheduleLoading(true);
    try {
      await rescheduleAppointment(apptId, {
        ...details,
        patientAge: Number(bookingAge) || 0,
        patientAddress: String(bookingAddress || "").trim(),
        patientGender: bookingGender
      }, token);
      showMsg("Appointment rescheduled successfully!");
      refreshAppts("patient", token);
      setRescheduleAppt(null);
    } catch (err) { showMsg(err.message || "Rescheduling failed"); }
    setRescheduleLoading(false);
  }, [bookingAge, bookingAddress, bookingGender, token, refreshAppts]);

  const handlePaymentSuccess = useCallback(async (paymentData) => {
    if (!/^\d{10}$/.test(bookingPhone)) {
      showMsg("Phone number must be exactly 10 digits");
      return;
    }
    if (!time) return showMsg("Please select a time slot");
    if (!bookingName || !bookingPhone || !bookingAge || !bookingAddress) return showMsg("Please fill all patient details");

    setAddLoading(true);
    setPayModal(false);
    try {
      const appt = await createAppointment({
        doctorId: selectedDoc._id,
        clinicId: selectedClinic._id,
        date,
        time,
        total_fee: Math.ceil(Number(selectedDoc.fee) * 1.05),
        patientName: String(bookingName || "").trim(),
        patientPhone: bookingPhone,
        patientAge: Number(bookingAge) || 0,
        patientAddress: String(bookingAddress || "").trim(),
        patientGender: bookingGender,
        reason: reason || "General Consultation",
        status: "pending",
        paymentOrderId: paymentData.orderId,
        paymentId: paymentData.paymentId,
        paymentSignature: paymentData.signature,
        amount: paymentData.amount,
      }, token);
      
      bookAppt(appt, token);
      showMsg("Appointment booked successfully!");
      sessionStorage.removeItem("activePatientFlow");
      
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Tym4DOC: Appt Booked!", {
          body: `Your booking with Dr. ${selectedDoc.lastName} is confirmed.`,
        });
      }
      
      setView("search");
      setTab("My Appointments");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { 
      showMsg(err.message || "Booking failed"); 
      setPayModal(true);
    }
    setAddLoading(false);
  }, [bookingName, bookingPhone, bookingAge, bookingAddress, bookingGender, time, date, selectedDoc, selectedClinic, reason, token, bookAppt, setTab, updateView]);

  const totalAppts = appointments.length;
  const upcomingAppts = appointments.filter(a => (a.status === "approved" || a.status === "pending") && a.date >= getLocalDayStr()).length;
  const completedAppts = appointments.filter(a => a.status === "completed" || (a.date < getLocalDayStr() && a.status !== "cancelled")).length;

  const s = {
    lbl: { fontSize: ".75rem", fontWeight: 700, color: C.gray500, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: ".05em" },
    inp: { width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.gray200}`, fontSize: ".9rem", fontFamily: "inherit" },
    btn: { padding: "10px 16px", borderRadius: 6, border: "none", background: C.blue, color: C.white, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }
  };

  // ── FINAL SAFETY GUARD ──
  // If anything above failed silently, we catch it here to prevent a total blank screen
  if (!view && !tab) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDir: "column", alignItems: "center", justifyContent: "center", background: C.gray50, padding: 20, textAlign: "center" }}>
        <h2 style={{ color: C.gray900 }}>Something went wrong</h2>
        <p style={{ color: C.gray500, marginTop: 10 }}>We encountered an error loading your dashboard.</p>
        <Btn onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ marginTop: 20 }}>Reset Everything</Btn>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.gray50, color: C.gray900 }}>
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: C.gray900,
          color: C.white, padding: "14px 22px", borderRadius: 8, fontSize: ".88rem", fontWeight: 700,
          boxShadow: "0 8px 16px rgba(0,0,0,.15)", animation: "fadeSlideUp .3s both",
        }}>
          {toast}
        </div>
      )}

      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: R.isMobile ? "24px 16px" : "32px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: R.isMobile ? "1.4rem" : "1.8rem", fontWeight: 800, color: C.gray900, marginBottom: 6 }}>
              {isGuest ? "Find a Specialist" : `Welcome back, ${session?.name?.split(" ")?.[0] || "User"}`}
            </h1>
            <p style={{ color: C.gray500, fontSize: ".9rem" }}>{isGuest ? "Search verified clinics and book instantly" : "Manage your healthcare journey"}</p>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: R.isMobile ? "1fr" : "repeat(3, 1fr)", 
            gap: R.isMobile ? 8 : 12, 
            flexGrow: R.isMobile ? 1 : 0,
            width: R.isMobile ? "100%" : "auto"
          }}>
            <StatCard label="Total" value={totalAppts} />
            <StatCard label="Upcoming" value={upcomingAppts} />
            <StatCard label="Completed" value={completedAppts} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: R.isMobile ? "20px 16px" : "32px 20px" }}>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: R.width < 480 ? "1fr" : R.isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(130px, 1fr))",
          background: C.gray100, 
          borderRadius: 8, 
          padding: 4, 
          gap: 4, 
          marginBottom: 32 
        }}>
          {["Search Clinics", "My Appointments", "Refund Policy", ...(isGuest ? [] : ["Settings"])].map(t => (
            <button
              key={t} onClick={() => { setTab(t); if (t === "Search Clinics") setView("search"); }}
              style={{
                padding: "12px 12px", border: "none", fontFamily: "inherit", fontWeight: 700,
                fontSize: R.width < 350 ? ".75rem" : ".85rem", cursor: "pointer", borderRadius: 6,
                background: tab === t ? C.blue : "transparent",
                color: tab === t ? C.white : C.gray500, transition: "all .2s ease",
                textAlign: "center",
                wordBreak: "break-word",
                whiteSpace: "normal"
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Search Clinics" && (
          <>
            <BookingProgress view={view} />
            {view === "search" && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <SectionHead title="Search Clinics" sub="Find and book appointments with verified clinics." />

                <form 
                  onSubmit={(e) => { e.preventDefault(); setShowSuggestions(false); handleSearch(); }} 
                  style={{ 
                    background: C.white, 
                    border: `1px solid ${C.gray200}`, 
                    borderRadius: 8, 
                    padding: 20, 
                    marginBottom: 24, 
                    position: "relative" 
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <input 
                        style={{ ...s.inp, paddingRight: 40 }} 
                        value={query} 
                        onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Search by Doctor, Clinic, or City" 
                      />
                      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.gray400, pointerEvents: "none" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                      </div>
                    </div>
                    
                    {showSuggestions && suggestions.length > 0 && (
                      <div ref={dropdownRef} style={{
                        position: "absolute", top: "100%", left: 0, right: 0,
                        background: C.white, border: `1px solid ${C.gray200}`,
                        borderRadius: "0 0 8px 8px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        zIndex: 100, marginTop: 4, maxHeight: 300, overflowY: "auto"
                      }}>
                        {suggestions.map((s, i) => (
                          <div 
                            key={i} 
                            onClick={() => handleSelectSuggestion(s)}
                            style={{
                              padding: "12px 16px", cursor: "pointer",
                              borderBottom: i === suggestions.length - 1 ? "none" : `1px solid ${C.gray100}`,
                              transition: "background .2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 700, fontSize: ".9rem", color: C.gray900 }}>{s.text}</span>
                              <span style={{ 
                                fontSize: ".6rem", 
                                fontWeight: 800, 
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: s.type === 'doctor' ? "#f1f5f9" : s.type === 'location' ? "#f0fdf4" : "#eff6ff",
                                color: s.type === 'doctor' ? "#475569" : s.type === 'location' ? "#166534" : "#1e40af",
                                textTransform: "uppercase", 
                                letterSpacing: ".05em" 
                              }}>
                                {s.type === 'location' ? 'City' : s.type}
                              </span>
                            </div>
                            <div style={{ fontSize: ".76rem", color: C.gray500, marginTop: 2 }}>{s.subtext}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </form>

                {clinicResults.length === 0 && !loading && (
                  <div style={{ textAlign: "center", padding: 60 }}>
                    <p style={{ fontSize: "1rem", fontWeight: 600, color: C.gray700 }}>Search for clinics, doctors, or cities to get started</p>
                    <p style={{ fontSize: ".85rem", marginTop: 4, color: C.gray400 }}>Your search results will appear here</p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  {clinicResults.map((c, i) => (
                    <AnimCard key={c._id} hoverable delay={i * 0.05} onClick={() => handleSelectClinic(c._id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h3 style={{ color: C.gray900, fontSize: "1.05rem", fontWeight: 800 }}>{c.name}</h3>
                          <p style={{ fontSize: ".82rem", color: C.gray500, marginTop: 4 }}>{c.address}, {c.city}, {c.state}</p>
                        </div>
                        <Bdg type="blue">Verified</Bdg>
                      </div>
                      {c.description && <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 12, lineHeight: 1.5 }}>{c.description}</p>}
                      <div style={{ marginTop: 14, fontSize: ".8rem", fontWeight: 700, color: C.blue }}>View Specialties &rarr;</div>
                    </AnimCard>
                  ))}
                </div>
              </div>
            )}

            {view === "clinic" && selectedClinic && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <button onClick={() => updateView("search")} style={{ ...s.btn, background: "none", color: C.gray500, padding: 0, marginBottom: 20 }}>&larr; Back to Search</button>
                <div style={{ background: C.white, border: `1px solid ${C.gray200}`, padding: R.isMobile ? "24px" : "32px", borderRadius: 8, marginBottom: 32 }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: C.gray900, marginBottom: 6 }}>{selectedClinic.name}</h2>
                  <p style={{ color: C.gray500, fontSize: ".9rem" }}>{selectedClinic.address}, {selectedClinic.city}, {selectedClinic.state}</p>
                  {selectedClinic.phone && <p style={{ color: C.gray500, marginTop: 4, fontSize: ".85rem" }}>{selectedClinic.phone}</p>}
                  {selectedClinic.description && <p style={{ color: C.gray700, marginTop: 12, fontSize: ".9rem", lineHeight: 1.6 }}>{selectedClinic.description}</p>}
                </div>

                <SectionHead title="Available Specialties" />
                {clinicSpecialties.length === 0 ? (
                  <p style={{ color: C.gray500 }}>No doctors currently available.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                    {clinicSpecialties.map((sp, i) => {
                      const findMeta = (name) => {
                        const lowName = name.toLowerCase();
                        let match = specialtyMeta.find(m => m.name.toLowerCase() === lowName);
                        if (match) return match;
                        
                        match = specialtyMeta.find(m => m.name.toLowerCase().includes(lowName) || lowName.includes(m.name.toLowerCase()));
                        if (match) return match;

                        if (lowName.includes("orthopedic")) return specialtyMeta.find(m => m.name.toLowerCase().includes("musculoskeletal"));
                        if (lowName === "eye" || lowName === "eyes") return specialtyMeta.find(m => m.name.toLowerCase().includes("ophthalmology"));
                        if (lowName === "skin") return specialtyMeta.find(m => m.name.toLowerCase().includes("dermatology"));
                        if (lowName === "brain") return specialtyMeta.find(m => m.name.toLowerCase().includes("neurology"));
                        if (lowName === "heart") return specialtyMeta.find(m => m.name.toLowerCase().includes("cardiology"));
                        
                        return null;
                      };

                      const meta = findMeta(sp);

                      return (
                        <AnimCard key={sp} hoverable delay={i * 0.04} onClick={() => handleSelectSpecialty(sp)} style={{ textAlign: "left", padding: "20px 16px" }}>
                          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C.blueLt}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", marginTop: 2 }}>
                              {meta?.image ? <img src={meta.image} alt="" style={{width: "100%", height: "100%", objectFit: "cover"}} /> : <strong style={{color:C.blue, fontSize: "1.1rem"}}>{sp[0]}</strong>}
                            </div>
                            <div style={{ flex: 1, paddingTop: 2 }}>
                              <h4 style={{ color: C.gray900, fontWeight: 800, fontSize: ".95rem", lineHeight: 1.2 }}>{sp}</h4>
                              <p style={{ fontSize: ".76rem", color: C.gray500, marginTop: 4, lineHeight: 1.4 }}>
                                {meta?.description || `Find highly qualified ${sp} specialists.`}
                              </p>
                            </div>
                          </div>
                        </AnimCard>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {view === "specialty" && selectedSpecialty && selectedClinic && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <button onClick={() => updateView("clinic")} style={{ ...s.btn, background: "none", color: C.gray500, padding: 0, marginBottom: 20 }}>&larr; Back to {selectedClinic?.name || "Clinic"}</button>
                <SectionHead title={`${selectedSpecialty} Doctors`} sub={`At ${selectedClinic?.name || "Clinic"}`} />

                {doctors.length === 0 ? (
                  <p style={{ color: C.gray500 }}>No doctors found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {doctors.map((d, i) => {
                      const isUnavail = d.unavailableUntil 
                        ? getLocalDayStr(new Date(d.unavailableUntil)) > getLocalDayStr()
                        : d.available === false;
                      
                      let unavailMsg = "Currently Unavailable";
                      if (isUnavail && d.unavailableUntil) {
                        unavailMsg = `Available from: ${new Date(d.unavailableUntil).toLocaleDateString()}`;
                      }
                      
                      return (
                      <AnimCard key={d._id} delay={i * 0.05}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                          <div 
                            onClick={() => { setSelectedDoc(d); updateView("doctor_profile"); }}
                            style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer", flex: 1 }}
                            title="Click to view full profile"
                          >
                            <div style={{ width: R.isMobile ? 110 : 85, height: R.isMobile ? 130 : 100, borderRadius: 10, background: C.gray100, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.gray500, overflow: "hidden", border: `1px solid ${C.gray200}`, flexShrink: 0 }}>
                              {d.photoUrl ? <img src={d.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: "1.2rem" }}>{`${d.firstName?.[0] || ""}${d.lastName?.[0] || ""}`}</div>}
                            </div>
                            <div style={{ flex: 1, paddingTop: 2 }}>
                              <h4 style={{ fontWeight: 800, fontSize: "1.2rem", color: C.gray900 }}>Dr. {d.firstName} {d.lastName}</h4>
                              <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 2 }}>{d.degree} - {d.exp} yrs exp</p>
                              {d.expertise && (
                                <p style={{ fontSize: ".76rem", color: C.blue, fontWeight: 700, marginTop: 4 }}>Expertise: {d.expertise}</p>
                              )}
                              {isUnavail && (
                                <div style={{ fontSize:".75rem", fontWeight:700, color: C.red, marginTop:6, background: "#fee2e2", padding: "2px 8px", borderRadius: 4, display: "inline-block" }}>
                                  {unavailMsg}
                                </div>
                              )}
                              {!isUnavail && (
                                <div style={{ fontSize:".75rem", fontWeight:700, color: C.green, marginTop:6, background: "#dcfce7", padding: "2px 8px", borderRadius: 4, display: "inline-block" }}>
                                  {calculateSlotsToday(d)} slots available today
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            flexDirection: R.isMobile ? "row" : "column", 
                            justifyContent: R.isMobile ? "space-between" : "flex-end",
                            alignItems: R.isMobile ? "center" : "flex-end",
                            gap: 12,
                            width: R.isMobile ? "100%" : "auto",
                            marginTop: 0,
                            borderTop: R.isMobile ? `1px solid ${C.gray100}` : "none",
                            paddingTop: 0
                          }}>
                            <div>
                              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: C.gray900 }}>₹{Math.ceil(Number(d.fee) * 1.05)}</div>
                              <div style={{ fontSize: ".7rem", color: C.gray400 }}>Incl. 5% platform fee</div>
                            </div>
                            <Btn onClick={() => handleSelectDoc(d)} style={{ padding: R.isMobile ? "8px 16px" : "10px 20px" }}>
                              {isGuest ? "Sign In to Book" : "Book"}
                            </Btn>
                          </div>
                        </div>
                      </AnimCard>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {view === "doctor_profile" && selectedDoc && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <button onClick={() => updateView("specialty")} style={{ ...s.btn, background: "none", color: C.gray500, padding: 0, marginBottom: 20 }}>&larr; Back to Doctor List</button>
                
                <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.gray200}`, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                  {/* Profile Header */}
                  <div style={{ background: `linear-gradient(135deg, ${C.blue}08, ${C.blue}15)`, padding: R.isMobile ? "24px 16px" : "48px 40px", display: "flex", flexDirection: R.width < 500 ? "column" : "row", gap: R.isMobile ? 24 : 40, alignItems: R.width < 500 ? "flex-start" : "center", flexWrap: "wrap" }}>
                    <div style={{ width: R.isMobile ? (R.width < 350 ? 110 : 140) : 180, height: R.isMobile ? (R.width < 350 ? 140 : 175) : 220, borderRadius: 16, overflow: "hidden", background: C.white, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: `4px solid ${C.white}`, flexShrink: 0 }}>
                      {selectedDoc.photoUrl ? <img src={selectedDoc.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem", background: C.gray100, color: C.gray400, fontWeight: 800 }}>{selectedDoc.firstName[0]}</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                         <span style={{ background: C.blue, color: C.white, padding: "4px 10px", borderRadius: 20, fontSize: ".65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>Verified Specialist</span>
                         {selectedDoc.exp > 10 && <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 20, fontSize: ".65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>Senior Doctor</span>}
                      </div>
                      <h2 style={{ fontSize: R.width < 350 ? "1.4rem" : R.isMobile ? "1.8rem" : "2.4rem", fontWeight: 900, color: C.gray900, marginBottom: 4 }}>Dr. {selectedDoc.firstName} {selectedDoc.lastName}</h2>
                      <p style={{ fontSize: "1rem", color: C.blue, fontWeight: 700, marginBottom: 16 }}>{selectedDoc.specialty} Specialist</p>
                      
                      <div style={{ display: "grid", gridTemplateColumns: R.width < 400 ? "1fr" : "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
                         <div style={{ background: `${C.white}90`, padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.gray100}` }}>
                           <div style={{ fontSize: ".65rem", color: C.gray500, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Experience</div>
                           <div style={{ fontSize: "0.95rem", fontWeight: 800, color: C.gray900 }}>{selectedDoc.exp}+ Years</div>
                         </div>
                         <div style={{ background: `${C.white}90`, padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.gray100}` }}>
                           <div style={{ fontSize: ".65rem", color: C.gray500, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Credentials</div>
                           <div style={{ fontSize: "0.95rem", fontWeight: 800, color: C.gray900 }}>{selectedDoc.degree}</div>
                         </div>
                         <div style={{ background: `${C.white}90`, padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.gray100}` }}>
                           <div style={{ fontSize: ".65rem", color: C.gray500, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Fee</div>
                           <div style={{ fontSize: "0.95rem", fontWeight: 800, color: C.gray900 }}>₹{Math.ceil(Number(selectedDoc.fee) * 1.05)}</div>
                         </div>
                      </div>

                      <Btn onClick={() => handleSelectDoc(selectedDoc)} style={{ width: "100%", padding: R.isMobile ? "12px 16px" : "14px 40px", fontSize: R.isMobile ? ".9rem" : "1rem", borderRadius: 12, boxShadow: "0 10px 20px rgba(59, 130, 246, 0.2)" }}>Book Appointment Now</Btn>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div style={{ padding: R.isMobile ? "24px 12px" : "40px", display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1.8fr 1fr", gap: 32 }}>
                    <div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: C.gray900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 4, height: 24, background: C.blue, borderRadius: 2 }}></span>
                        Professional Bio
                      </h3>
                      <p style={{ fontSize: ".95rem", color: C.gray600, lineHeight: 1.6, marginBottom: 32, textAlign: "justify" }}>
                        {selectedDoc.bio || `Dr. ${selectedDoc.firstName} ${selectedDoc.lastName} is a highly accomplished ${selectedDoc.specialty} specialist dedicated to providing exceptional patient care at ${selectedClinic?.name}. With ${selectedDoc.exp} years of clinical experience, they have developed a reputation for excellence in their field.`}
                      </p>

                      <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: C.gray900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 4, height: 24, background: C.blue, borderRadius: 2 }}></span>
                        Expertise & Skills
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
                        {(selectedDoc.expertise || selectedDoc.specialty).split(/[,/]/).map((skill, si) => (
                          <span key={si} style={{ background: C.gray100, color: C.gray700, padding: "8px 16px", borderRadius: 8, fontSize: ".9rem", fontWeight: 600 }}>
                            {skill.trim()}
                          </span>
                        ))}
                      </div>

                      <div style={{ background: C.gray50, borderRadius: 16, padding: 24, border: `1px solid ${C.gray100}` }}>
                        <h4 style={{ fontSize: ".9rem", fontWeight: 800, color: C.gray800, marginBottom: 12 }}>Medical Registration</h4>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <span style={{ fontSize: ".85rem", color: C.gray500 }}>Registration Number</span>
                           <span style={{ fontSize: ".85rem", fontWeight: 800, color: C.gray900 }}>{selectedDoc.regNo || "VERIFIED"}</span>
                        </div>
                        {selectedDoc.college && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                             <span style={{ fontSize: ".85rem", color: C.gray500 }}>Medical College</span>
                             <span style={{ fontSize: ".85rem", fontWeight: 800, color: C.gray900 }}>{selectedDoc.college}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16, padding: 24 }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: C.gray900, marginBottom: 16 }}>Live Availability</h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.gray50, borderRadius: 10, border: `1px solid ${C.gray100}` }}>
                              <span style={{ fontSize: ".85rem", fontWeight: 700, color: C.gray600 }}>Slots Today</span>
                              <span style={{ fontSize: ".9rem", fontWeight: 800, color: calculateSlotsToday(selectedDoc) > 0 ? C.green : C.red }}>
                                {calculateSlotsToday(selectedDoc)} Available
                              </span>
                           </div>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.gray50, borderRadius: 10, border: `1px solid ${C.gray100}` }}>
                              <span style={{ fontSize: ".85rem", fontWeight: 700, color: C.gray600 }}>Slots Tomorrow</span>
                              <span style={{ fontSize: ".9rem", fontWeight: 800, color: (() => {
                                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                                const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
                                return calculateSlotsOnDate(selectedDoc, tStr) > 0 ? C.green : C.red;
                              })() }}>
                                {(() => {
                                  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                                  const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
                                  return calculateSlotsOnDate(selectedDoc, tStr);
                                })()} Available
                              </span>
                           </div>
                        </div>

                        {/* Shift Schedule */}
                        <div style={{ marginTop: 24, padding: "16px 0", borderTop: `1px dashed ${C.gray200}` }}>
                           <h4 style={{ fontSize: ".75rem", fontWeight: 800, color: C.gray500, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Working Schedule</h4>
                           <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}>
                                 <span style={{ color: C.gray500 }}>Slot Duration</span>
                                 <span style={{ fontWeight: 800, color: C.gray900 }}>{selectedDoc.slotDuration || 30} Mins</span>
                              </div>
                              {[
                                { label: "Morning Shift", active: selectedDoc.morningActive, start: selectedDoc.morningStartTime, end: selectedDoc.morningEndTime },
                                { label: "Afternoon Shift", active: selectedDoc.afternoonActive, start: selectedDoc.afternoonStartTime, end: selectedDoc.afternoonEndTime },
                                { label: "Evening Shift", active: selectedDoc.eveningActive, start: selectedDoc.eveningStartTime, end: selectedDoc.eveningEndTime },
                                { label: "Night Shift", active: selectedDoc.nightActive, start: selectedDoc.nightStartTime, end: selectedDoc.nightEndTime },
                              ].map((shift, idx) => (
                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}>
                                   <span style={{ color: C.gray500 }}>{shift.label}</span>
                                   <span style={{ fontWeight: 700, color: shift.active !== false ? C.blue : C.gray400 }}>
                                      {shift.active !== false ? `${formatTime12(shift.start)} - ${formatTime12(shift.end)}` : "Inactive"}
                                   </span>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div style={{ marginTop: 24, borderTop: `1px solid ${C.gray100}`, paddingTop: 20 }}>
                          <div style={{ fontWeight: 800, color: C.blue, fontSize: "1rem" }}>{selectedClinic?.name}</div>
                          <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 4, lineHeight: 1.5 }}>
                            {selectedClinic?.address}<br/>
                            {selectedClinic?.city}, {selectedClinic?.state}
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: 24, padding: 20, textAlign: "center" }}>
                        <p style={{ fontSize: ".8rem", color: C.gray400 }}>
                          Appointment confirmation is instant.<br/>
                          Secure payment via Razorpay.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "book" && selectedDoc && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <button onClick={() => updateView("specialty")} style={{ ...s.btn, background: "none", color: C.gray500, padding: 0, marginBottom: 20 }}>&larr; Back to Doctors</button>
                
                <div style={{ maxWidth: 500, margin: "0 auto" }}>
                  <SectionHead title="Book Appointment" />
                  
                  <div style={{ background: C.white, border: `1px solid ${C.gray200}`, padding: R.isMobile ? "16px 12px" : 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20, borderBottom: `1px solid ${C.gray100}`, paddingBottom: 16 }}>
                      <div style={{ width: R.isMobile ? 100 : 85, height: R.isMobile ? 120 : 100, borderRadius: 10, background: C.gray100, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.gray500, overflow: "hidden", flexShrink: 0, border: `1px solid ${C.gray200}` }}>
                        {selectedDoc?.photoUrl ? <img src={selectedDoc.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: "1.2rem" }}>{`${selectedDoc?.firstName?.[0] || ""}${selectedDoc?.lastName?.[0] || ""}`}</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        <strong style={{ fontSize: "1.1rem", color: C.gray900, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Dr. {selectedDoc?.firstName} {selectedDoc?.lastName}</strong>
                        <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 2 }}>{selectedDoc?.specialty || selectedSpecialty}</p>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.gray900 }}>
                          ₹{Math.ceil(Number(selectedDoc?.fee || 0) * 1.05)}
                        </div>
                        <div style={{ fontSize: ".75rem", color: C.gray500, marginTop: 2 }}>
                          Total amount to pay
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={s.lbl}>Select Date</label>
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                        <CalendarPicker 
                          selectedDate={date}
                          minDate={(() => {
                            const todayStr = getLocalDayStr();
                            if (selectedDoc?.available === false && selectedDoc?.unavailableUntil) {
                              const dObj = new Date(selectedDoc.unavailableUntil);
                              if (!isNaN(dObj.getTime())) {
                                const returnDate = getLocalDayStr(dObj);
                                return returnDate > todayStr ? returnDate : todayStr;
                              }
                            }
                            return todayStr;
                          })()}
                          maxDate={maxDate}
                          onSelect={handleDateChange}
                        />
                      </div>
                      {date && (
                        <div style={{ textAlign: "center", marginTop: 12, fontSize: ".9rem", fontWeight: 700, color: C.blue }}>
                          Selected: {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      )}
                    </div>

                    {date && (() => {
                      const tabsToDisplay = [
                        { id: "morning", label: "Morning" },
                        { id: "afternoon", label: "Afternoon" },
                        { id: "evening", label: "Evening" },
                        { id: "night", label: "Night" }
                      ].filter(t => availableSlots[t.id] && availableSlots[t.id].length > 0);

                      const currentActiveShift = tabsToDisplay.find(t => t.id === activeShift) 
                        ? activeShift 
                        : (tabsToDisplay.length > 0 ? tabsToDisplay[0].id : "");

                      const shiftSlots = currentActiveShift ? (availableSlots[currentActiveShift] || []) : [];

                      const fmt12h = (hrStr) => {
                        const h = parseInt(hrStr, 10);
                        const display = h % 12 === 0 ? 12 : h % 12;
                        const mer = h >= 12 ? "PM" : "AM";
                        return `${display} ${mer}`;
                      };

                      const fmtTime = (t) => {
                        if (!t) return "";
                        const [hh, mm] = t.split(":");
                        const h = parseInt(hh, 10);
                        const display = h % 12 === 0 ? 12 : h % 12;
                        const mer = h >= 12 ? "PM" : "AM";
                        return `${display}:${mm} ${mer}`;
                      };

                      const hourGroups = {};
                      shiftSlots.forEach(sl => {
                        const hr = sl.start.split(":")[0];
                        if (!hourGroups[hr]) hourGroups[hr] = [];
                        hourGroups[hr].push(sl);
                      });
                      const hourKeys = Object.keys(hourGroups).sort((a,b) => parseInt(a)-parseInt(b)).filter(hr => {
                        return hourGroups[hr].length > 0;
                      });
                      const slotsInSelected = selectedHourRange ? (hourGroups[selectedHourRange] || []) : [];

                      return (
                        <div style={{ marginBottom: 24 }}>
                          <label style={{ ...s.lbl, marginBottom: 12 }}>Available Slots</label>

                          {availableSlots._cutoffMessage ? (
                            <div style={{ padding: 20, textAlign: "center", color: C.red, fontSize: ".85rem", border: `1px dashed ${C.red}`, borderRadius: 8, background: "#fee2e2" }}>
                              {availableSlots._cutoffMessage}
                            </div>
                          ) : tabsToDisplay.length === 0 ? (
                            <div style={{ padding: 20, textAlign: "center", color: C.red, fontSize: ".85rem", border: `1px dashed ${C.red}`, borderRadius: 8, background: "#fff5f5" }}>
                              No slots available for this date.
                            </div>
                          ) : (
                            <>
                              <div style={{ marginBottom: 16 }}>
                                <TabBtns
                                  tabs={tabsToDisplay}
                                  active={currentActiveShift}
                                  onChange={handleShiftChange}
                                />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 16 }}>
                                {hourKeys.map(hr => {
                                  const nextHr = String(Number(hr) + 1).padStart(2, "0");
                                  const isActive = selectedHourRange === hr;
                                  return (
                                    <div
                                      key={hr}
                                      onClick={() => setSelectedHourRange(isActive ? null : hr)}
                                      style={{
                                        padding: "10px 4px",
                                        textAlign: "center",
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        border: isActive ? `2px solid ${C.blue}` : `1px solid ${C.gray200}`,
                                        background: isActive ? C.blue : C.white,
                                        color: isActive ? C.white : C.gray700,
                                        fontWeight: 700,
                                        fontSize: ".78rem",
                                        transition: "all .15s ease"
                                      }}
                                    >
                                      {fmt12h(hr)} – {fmt12h(nextHr)}
                                      <div style={{ fontSize: ".72rem", marginTop: 3, opacity: 0.7 }}>
                                        {hourGroups[hr].length} slot{hourGroups[hr].length !== 1 ? "s" : ""}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {selectedHourRange && (
                                <div ref={slotsDetailRef} style={{ paddingTop: 4 }}>
                                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: C.gray500, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>
                                    {fmt12h(selectedHourRange)} – {fmt12h(String(Number(selectedHourRange) + 1).padStart(2, "0"))}
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                                    {slotsInSelected.map((sl, i) => (
                                      <div
                                        key={i}
                                        onClick={() => setTime(sl.start)}
                                        style={{
                                          padding: "12px 6px",
                                          textAlign: "center",
                                          border: time === sl.start ? `2px solid ${C.blue}` : `1px solid ${C.gray200}`,
                                          borderRadius: 8,
                                          cursor: "pointer",
                                          background: time === sl.start ? C.blue : C.white,
                                          fontSize: ".82rem",
                                          fontWeight: 700,
                                          color: time === sl.start ? C.white : C.gray700,
                                          transition: "all .15s ease"
                                        }}
                                      >
                                        {fmtTime(sl.start)} – {fmtTime(sl.end)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}


                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (isGuest) {
                        sessionStorage.setItem("pendingBooking", JSON.stringify({ 
                          selectedClinic, 
                          selectedSpecialty, 
                          selectedDoc, 
                          date,
                          bookingName,
                          bookingPhone,
                          bookingAge,
                          bookingAddress,
                          bookingGender,
                          view: "book" 
                        }));
                        navigate("/patient/auth");
                        return;
                      }
                      if (window.confirm(`Are you sure you want to book this appointment for ₹${Math.ceil(Number(selectedDoc.fee) * 1.05)}?`)) {
                        setPayModal(true);
                      }
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <div>
                          <label style={s.lbl}>Name for Booking *</label>
                          <input style={s.inp} value={bookingName} onChange={e => setBookingName(e.target.value)} placeholder="Full Name" />
                        </div>
                        <div>
                          <label style={s.lbl}>Phone Number *</label>
                          <input type="tel" maxLength="10" style={s.inp} value={bookingPhone} onChange={e => setBookingPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit phone" />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        <div>
                          <label style={s.lbl}>Age *</label>
                          <input type="number" style={s.inp} value={bookingAge} onChange={e => setBookingAge(e.target.value)} placeholder="00" />
                        </div>
                        <div>
                          <label style={s.lbl}>Gender *</label>
                          <select style={s.inp} value={bookingGender} onChange={e => setBookingGender(e.target.value)}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={s.lbl}>Full Address *</label>
                        <input style={s.inp} value={bookingAddress} onChange={e => setBookingAddress(e.target.value)} placeholder="Street, City, Pincode" />
                      </div>

                      <Inp label="Reason (Optional)" placeholder="e.g. Checkup" value={reason} onChange={e => setReason(e.target.value)} />

                      <div ref={formRef} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px 16px", background: C.gray50, borderRadius: 8, border: `1px solid ${C.gray100}` }}>
                         <span style={{ fontSize: ".85rem", color: C.gray500, fontWeight: 600 }}>Doctor Fee: ₹{selectedDoc?.fee || 0} <br/> + Platform Fee (5%): ₹{Math.ceil(Number(selectedDoc?.fee || 0) * 0.05)}</span>
                         <span style={{ fontSize: "1.1rem", fontWeight: 800, color: C.gray900 }}>Total: ₹{Math.ceil(Number(selectedDoc?.fee || 0) * 1.05)}</span>
                      </div>

                      <Btn type="submit" full disabled={(!isGuest && (!date || !time || !bookingName || !bookingPhone || !bookingAge || !bookingAddress || !bookingGender)) || addLoading} 
                           style={{ padding: 14, fontSize: ".95rem" }}>
                        {isGuest ? "Sign In to Book" : addLoading ? "Processing..." : `Confirm & Pay ₹${Math.ceil(Number(selectedDoc.fee) * 1.05)}`}
                      </Btn>
                      <p style={{ textAlign: "center", fontSize: ".76rem", color: C.gray400, marginTop: 12 }}>Secured by Razorpay • Instant Confirmation</p>
                    </form>
                  </div>
                </div>

                <PaymentModal open={payModalOpen} onClose={() => setPayModal(false)} onSuccess={handlePaymentSuccess} onFail={(msg) => { setPayModal(false); showMsg(msg); }} doctor={{ ...selectedDoc, name: `Dr. ${selectedDoc.firstName} ${selectedDoc.lastName}`, spec: selectedDoc.specialty }} token={token} />
              </div>
            )}
          </>
        )}

        {tab === "My Appointments" && (() => {
          if (isGuest) {
            return (
              <div style={{ animation: "fadeSlideUp .3s both", textAlign: "center", padding: "60px 20px", background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: C.gray900, marginBottom: 8 }}>Sign In Required</h2>
                <p style={{ color: C.gray500, fontSize: ".95rem", maxWidth: 300, margin: "0 auto 24px" }}>
                  Please log in to view your appointment history and manage your bookings.
                </p>
                <Btn onClick={() => {
                   sessionStorage.setItem("authRedirect", "appointments");
                   navigate("/patient/auth");
                }} style={{ padding: "12px 32px" }}>Sign In / Register</Btn>
              </div>
            );
          }
          const filteredAppts = appointments.filter(a => {
            if (apptHistoryFilter === "All") return true;
            if (apptHistoryFilter === "Upcoming") return a.status === "approved" && a.date >= getLocalDayStr();
            if (apptHistoryFilter === "Completed") return a.status === "completed" || (a.date < getLocalDayStr() && a.status !== "cancelled");
            if (apptHistoryFilter === "Cancelled") return a.status === "cancelled";
            return true;
          });
          return (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <SectionHead title="My Appointments" sub="Manage your bookings" />
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: R.isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(100px, 1fr))", 
              gap: 8, 
              marginBottom: 20,
              width: R.isMobile ? "100%" : "auto"
            }}>
              {["All", "Upcoming", "Completed", "Cancelled"].map(f => (
                <button
                  key={f}
                  onClick={() => setApptHistoryFilter(f)}
                  style={{
                    padding: R.isMobile ? "10px 8px" : "8px 14px",
                    borderRadius: 8,
                    border: apptHistoryFilter === f ? "none" : `1.5px solid ${C.gray300}`,
                    fontSize: R.isMobile ? ".78rem" : ".85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: apptHistoryFilter === f ? C.blue : "transparent",
                    color: apptHistoryFilter === f ? C.white : C.gray700,
                    transition: "all .2s",
                    whiteSpace: "nowrap"
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {filteredAppts.length === 0 ? (
              <p style={{ color: C.gray500, textAlign: "center", padding: 40, background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
                {appointments.length === 0 ? "No appointments yet." : `No ${apptHistoryFilter.toLowerCase()} appointments found.`}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredAppts.map((a, i) => {
                  const docName = a.doctorName || (typeof a.doctorId === "object" ? `Dr. ${a.doctorId?.firstName} ${a.doctorId?.lastName}` : "Doctor");
                  const clinicName = typeof a.clinicId === "object" ? a.clinicId?.name : "";
                  return (
                    <AnimCard key={a._id || a.id} delay={i * 0.05} style={{ padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                          <h4 style={{ fontWeight: 800, fontSize: "1.05rem", color: C.gray900 }}>{docName}</h4>
                          <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 2 }}>At {clinicName}</p>
                          <div style={{ fontSize: ".88rem", fontWeight: 800, color: C.blue, marginTop: 10 }}>Patient: {a.patientName}</div>
                          {a.patientId && typeof a.patientId === "object" && (
                            <div style={{ fontSize: ".76rem", color: C.gray500, fontWeight: 700, marginTop: 2 }}>
                               Account Holder: {a.patientId.firstName} {a.patientId.lastName}
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, fontSize: ".85rem", color: C.gray700, fontWeight: 600 }}>
                            <span>Date: {a.date}</span>
                            <span>Time: {formatSlotRange(formatTime12(a.time), a.slotDuration)}</span>
                            <span>Age: {a.patientAge || "N/A"}</span>
                            <span>Gen: {a.patientGender || "N/A"}</span>
                          </div>
                          <div style={{ fontSize: ".85rem", color: C.gray700, fontWeight: 600, marginTop: 4 }}>
                            <span>Address: {a.patientAddress || "N/A"}</span>
                          </div>
                          <div style={{ fontSize: ".85rem", color: C.gray700, fontWeight: 600, marginTop: 4 }}>
                            <span>Total: Rs.{a.total_fee}</span>
                          </div>
                          {a.reason && <p style={{ fontSize: ".85rem", color: C.gray500, marginTop: 6 }}>Reason: {a.reason}</p>}
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <Bdg type={a.status === "approved" ? "green" : a.status === "cancelled" ? "red" : a.status === "completed" || (a.date < getLocalDayStr() && a.status !== "cancelled") ? "blue" : "amber"}>
                              {a.date < getLocalDayStr() && a.status !== "cancelled" ? "COMPLETED" : a.status.toUpperCase()}
                            </Bdg>
                            {a.payment?.status === "paid" && <Bdg type="green">PAID</Bdg>}
                            {a.payment?.status === "refunded" && <Bdg type="amber">REFUNDED</Bdg>}
                          </div>
                          {a.rescheduleSuggest && a.rescheduleSuggest.date && (
                            <div style={{ marginTop: 14, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <div style={{ background: "#fef3c7", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#d97706", fontWeight: 900 }}>!</div>
                              <div>
                                <h5 style={{ fontSize: ".76rem", fontWeight: 800, color: "#92400e", marginBottom: 3, textTransform: "uppercase" }}>Doctor's Recommendation</h5>
                                <p style={{ fontSize: ".82rem", color: "#b45309", lineHeight: 1.4 }}>
                                  The clinic suggests <strong>{new Date(a.rescheduleSuggest.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong> as a better date for your visit.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {a.status === "approved" && a.date >= getLocalDayStr() && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <Btn color="out" style={{ fontSize: ".8rem" }} onClick={() => {
                                setRescheduleAppt(a);
                                setRescheduleDate("");
                                setRescheduleTime("");
                              }}>Reschedule</Btn>
                              <Btn color="out" style={{ color: C.red, borderColor: C.red, fontSize: ".8rem" }} onClick={() => cancelAppt(a._id || a.id, null, token)}>Cancel</Btn>
                            </div>
                          )}
                          {typeof a.doctorId === "object" && typeof a.clinicId === "object" && (a.status === "cancelled" || a.status === "completed" || a.date < getLocalDayStr()) && (
                            <button 
                              onClick={() => {
                                setSelectedClinic(a.clinicId);
                                setSelectedDoc(a.doctorId);
                                setDate("");
                                setTime("");
                                setBookedSlots([]);
                                navigateInternal("Search Clinics", "book");
                              }}
                              style={{ padding: "8px 16px", background: C.gray100, color: C.blue, border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}
                            >
                              Re-book Doctor
                            </button>
                          )}
                        </div>
                      </div>
                    </AnimCard>
                  );
                })}
              </div>
            )}
          </div>
        )})()}

        {tab === "Refund Policy" && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <SectionHead title="Refund Policy" sub="Understand our cancellation rules" />
            <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 30 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 12, color: C.gray900 }}>Full Refund (100%)</h3>
              <ul style={{ color: C.gray700, fontSize: ".9rem", paddingLeft: 20, marginBottom: 24, lineHeight: 1.6 }}>
                <li>Cancellation made more than 4 hours before the appointment</li>
                <li>Doctor or clinic cancels or reschedules</li>
              </ul>
              
              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 12, color: C.gray900 }}>Partial Refund (75%)</h3>
              <ul style={{ color: C.gray700, fontSize: ".9rem", paddingLeft: 20, marginBottom: 24, lineHeight: 1.6 }}>
                <li>Cancellation made between 1-4 hours before the appointment</li>
              </ul>

              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 12, color: C.gray900 }}>No Refund</h3>
              <ul style={{ color: C.gray700, fontSize: ".9rem", paddingLeft: 20, marginBottom: 24, lineHeight: 1.6 }}>
                <li>Cancellation within 1 hour or no-show</li>
                <li>Platform fee (5%) is non-refundable in all scenarios</li>
              </ul>

              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 12, color: C.gray900 }}>Rescheduling</h3>
              <ul style={{ color: C.gray700, fontSize: ".9rem", paddingLeft: 20, lineHeight: 1.6 }}>
                <li>Patients can reschedule an appointment by paying a convenience fee of 15% of the original fee.</li>
                <li>The rescheduling fee is non-refundable.</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "Settings" && !isGuest && (() => {
          // Load profile on first visit
          if (!settingsLoaded && token) {
            setSettingsLoaded(true);
            getMyProfile("patient", token).then(p => {
              setProfFirstName(p.firstName || "");
              setProfLastName(p.lastName || "");
              setProfEmail(p.email || "");
            }).catch(() => {});
          }

          const handleUpdateProfile = async () => {
            setProfLoading(true);
            try {
              const res = await updatePatientProfile({ firstName: profFirstName, lastName: profLastName, email: profEmail }, token);
              await refreshProfile();
              showMsg(res.message || "Profile updated!");
            } catch (err) { showMsg(err.message || "Update failed"); }
            setProfLoading(false);
          };

          const handleChangePass = async () => {
            if (!cpCurrent || !cpNew) { showMsg("Fill all password fields"); return; }
            if (cpNew.length < 8) { showMsg("New password must be at least 8 characters"); return; }
            if (cpNew !== cpConfirm) { showMsg("Passwords do not match"); return; }
            setCpLoading(true);
            try {
              const res = await changePassword(cpCurrent, cpNew, token);
              showMsg(res.message || "Password changed!");
              setCpCurrent(""); setCpNew(""); setCpConfirm("");
            } catch (err) { showMsg(err.message || "Failed to change password"); }
            setCpLoading(false);
          };

          return (
            <div style={{ animation: "fadeSlideUp .3s both", maxWidth: 600, margin: "0 auto" }}>
              <SectionHead title="Account Settings" sub="Update your profile and password" />

              {/* Update Profile */}
              <form onSubmit={e => { e.preventDefault(); handleUpdateProfile(); }} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: R.isMobile ? 20 : 28, marginBottom: 24 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: C.gray900, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  Update Profile
                </h3>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.lbl}>Email</label>
                  <input type="email" style={s.inp} value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="Email Address" required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={s.lbl}>First Name</label>
                    <input style={s.inp} value={profFirstName} onChange={e => setProfFirstName(e.target.value)} placeholder="First Name" />
                  </div>
                  <div>
                    <label style={s.lbl}>Last Name</label>
                    <input style={s.inp} value={profLastName} onChange={e => setProfLastName(e.target.value)} placeholder="Last Name" />
                  </div>
                </div>
                <Btn type="submit" full disabled={profLoading}>
                  {profLoading ? "Saving..." : "Save Profile"}
                </Btn>
              </form>

              {/* Change Password */}
              <form onSubmit={e => { e.preventDefault(); handleChangePass(); }} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: R.isMobile ? 20 : 28 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: C.gray900, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  Change Password
                </h3>
                  <Inp label="Current Password" type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} placeholder="Your current password" />
                <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div>
                    <Inp label="New Password" type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} placeholder="Min. 8 characters" />
                  </div>
                  <div>
                    <Inp label="Confirm New Password" type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} placeholder="Repeat new password" />
                  </div>
                </div>
                <Btn type="submit" full color="amber" disabled={cpLoading}>
                  {cpLoading ? "Changing..." : "Change Password"}
                </Btn>
              </form>
            </div>
          );
        })()}
      </div>

      {rescheduleAppt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 450, maxHeight: "90vh", overflowY: "auto", padding: 24, animation: "fadeSlideUp .3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <SectionHead title="Reschedule Appointment" sub={`Dr. ${rescheduleAppt.doctorName || rescheduleAppt.doctorId?.lastName}`} />
              <button onClick={() => setRescheduleAppt(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: C.gray400 }}>&times;</button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={s.lbl}>Select New Date</label>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <CalendarPicker 
                  minDate={getLocalDayStr()} 
                  maxDate={getLocalDayStr(new Date(Date.now() + (rescheduleAppt.clinicId?.maxBookingDays || 7) * 24 * 60 * 60 * 1000))}
                  selectedDate={rescheduleDate} 
                  onSelect={async (d) => {
                    setRescheduleDate(d);
                    const booked = await getBookedSlots(rescheduleAppt.doctorId?._id || rescheduleAppt.doctorId, d);
                    setRescheduleBookedSlots(Array.isArray(booked) ? booked : []);
                    setRescheduleTime("");
                    setRescheduleActiveShift("morning");
                    setRescheduleSelectedHourRange(null);
                  }} 
                />
              </div>
            </div>

            {rescheduleDate && (
              <div style={{ marginBottom: 24 }}>
                <label style={s.lbl}>Select New Time</label>
                {(() => {
                  const doc = rescheduleAppt.doctorId;
                  if (typeof doc !== "object") return <p style={{ fontSize: ".8rem", color: C.red }}>Error: Doctor details not available for slot calculation.</p>;
                  
                  const isCutoffExceeded = (() => {
                    if (!doc.tomorrowBookingCutoffTime || !rescheduleDate) return false;
                    const cutoffMins = parseSlotMinutes(doc.tomorrowBookingCutoffTime);
                    const isSameDayCutoff = doc.bookingCutoffDay === "same_day";
                    const apptDateObj = new Date(rescheduleDate);
                    if (!isSameDayCutoff) apptDateObj.setDate(apptDateObj.getDate() - 1);
                    const deadlineDateStr = getLocalDayStr(apptDateObj);
                    if (today > deadlineDateStr) return true;
                    if (today === deadlineDateStr) return nowMinutes > cutoffMins;
                    return false;
                  })();

                  const filterFn = (s) => {
                    if (rescheduleBookedSlots.includes(s.start)) return false;
                    const slotMins = parseSlotMinutes(s.start);
                    const offsetMins = doc.slotBookingOffset ? parseSlotMinutes(doc.slotBookingOffset) : 0;
                    if (rescheduleDate === today) return slotMins > (nowMinutes + offsetMins);
                    if (isCutoffExceeded) return false;
                    return true;
                  };

                  const categorized = { morning: [], afternoon: [], evening: [], night: [] };
                  const duration = Number(doc.slotDuration) || 30;
                  const allRanges = [
                    { key: 'morning', s: doc.morningActive !== false ? doc.morningStartTime || "08:00" : null, e: doc.morningActive !== false ? doc.morningEndTime || "12:00" : null },
                    { key: 'afternoon', s: doc.afternoonActive !== false ? doc.afternoonStartTime || "12:00" : null, e: doc.afternoonActive !== false ? doc.afternoonEndTime || "16:00" : null },
                    { key: 'evening', s: doc.eveningActive !== false ? doc.eveningStartTime || "16:00" : null, e: doc.eveningActive !== false ? doc.eveningEndTime || "20:00" : null },
                    { key: 'night', s: doc.nightActive !== false ? doc.nightStartTime || "20:00" : null, e: doc.nightActive !== false ? doc.nightEndTime || "23:59" : null },
                  ];

                  allRanges.forEach(r => {
                    if (!r.s || !r.e) return;
                    categorized[r.key] = generateSlotsInRange(r.s, r.e, duration).filter(filterFn);
                  });

                  if (isCutoffExceeded && doc.tomorrowBookingCutoffTime) {
                    return <p style={{ fontSize: ".85rem", color: C.red, background: "#fee2e2", padding: 12, borderRadius: 8, textAlign: "center" }}>Bookings for this date are closed.</p>;
                  }

                  const tabsToDisplay = [
                    { id: "morning", label: "Morning" },
                    { id: "afternoon", label: "Afternoon" },
                    { id: "evening", label: "Evening" },
                    { id: "night", label: "Night" }
                  ].filter(t => categorized[t.id] && categorized[t.id].length > 0);

                  const currentActiveShift = tabsToDisplay.find(t => t.id === rescheduleActiveShift) 
                    ? rescheduleActiveShift 
                    : (tabsToDisplay.length > 0 ? tabsToDisplay[0].id : "");

                  const shiftSlots = currentActiveShift ? (categorized[currentActiveShift] || []) : [];

                  const fmt12h = (hrStr) => {
                    const h = parseInt(hrStr, 10);
                    const display = h % 12 === 0 ? 12 : h % 12;
                    const mer = h >= 12 ? "PM" : "AM";
                    return `${display} ${mer}`;
                  };

                  const fmtTime = (t) => {
                    if (!t) return "";
                    const [hh, mm] = t.split(":");
                    const h = parseInt(hh, 10);
                    const display = h % 12 === 0 ? 12 : h % 12;
                    const mer = h >= 12 ? "PM" : "AM";
                    return `${display}:${mm} ${mer}`;
                  };

                  const hourGroups = {};
                  shiftSlots.forEach(sl => {
                    const hr = sl.start.split(":")[0];
                    if (!hourGroups[hr]) hourGroups[hr] = [];
                    hourGroups[hr].push(sl);
                  });
                  const hourKeys = Object.keys(hourGroups).sort((a,b) => parseInt(a)-parseInt(b)).filter(hr => hourGroups[hr].length > 0);
                  const slotsInSelected = rescheduleSelectedHourRange ? (hourGroups[rescheduleSelectedHourRange] || []) : [];

                  return (
                    <div style={{ marginBottom: 24 }}>
                      {tabsToDisplay.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: C.red, fontSize: ".85rem", border: `1px dashed ${C.red}`, borderRadius: 8, background: "#fff5f5" }}>
                          No slots available for this date.
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: 16 }}>
                            <TabBtns
                              tabs={tabsToDisplay}
                              active={currentActiveShift}
                              onChange={(shift) => { setRescheduleActiveShift(shift); setRescheduleSelectedHourRange(null); setRescheduleTime(""); }}
                            />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 16 }}>
                            {hourKeys.map(hr => {
                              const nextHr = String(Number(hr) + 1).padStart(2, "0");
                              const isActive = rescheduleSelectedHourRange === hr;
                              return (
                                <div
                                  key={hr}
                                  onClick={() => setRescheduleSelectedHourRange(isActive ? null : hr)}
                                  style={{
                                    padding: "10px 4px",
                                    textAlign: "center",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    border: isActive ? `2px solid ${C.blue}` : `1px solid ${C.gray200}`,
                                    background: isActive ? C.blue : C.white,
                                    color: isActive ? C.white : C.gray700,
                                    fontWeight: 700,
                                    fontSize: ".78rem",
                                    transition: "all .15s ease"
                                  }}
                                >
                                  {fmt12h(hr)} – {fmt12h(nextHr)}
                                  <div style={{ fontSize: ".72rem", marginTop: 3, opacity: 0.7 }}>
                                    {hourGroups[hr].length} slot{hourGroups[hr].length !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {rescheduleSelectedHourRange && (
                            <div style={{ paddingTop: 4 }}>
                              <div style={{ fontSize: ".78rem", fontWeight: 700, color: C.gray500, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>
                                {fmt12h(rescheduleSelectedHourRange)} – {fmt12h(String(Number(rescheduleSelectedHourRange) + 1).padStart(2, "0"))}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                                {slotsInSelected.map((sl, i) => (
                                  <div
                                    key={i}
                                    onClick={() => setRescheduleTime(sl.start)}
                                    style={{
                                      padding: "12px 6px",
                                      textAlign: "center",
                                      border: rescheduleTime === sl.start ? `2px solid ${C.blue}` : `1px solid ${C.gray200}`,
                                      borderRadius: 8,
                                      cursor: "pointer",
                                      background: rescheduleTime === sl.start ? C.blue : C.white,
                                      fontSize: ".82rem",
                                      fontWeight: 700,
                                      color: rescheduleTime === sl.start ? C.white : C.gray700,
                                      transition: "all .15s ease"
                                    }}
                                  >
                                    {fmtTime(sl.start)} – {fmtTime(sl.end)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ background: C.gray50, borderRadius: 8, padding: 16, marginBottom: 24, border: `1px solid ${C.gray200}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: ".82rem", color: C.gray500, fontWeight: 700 }}>Rescheduling Fee (15%)</span>
                <span style={{ fontSize: ".82rem", fontWeight: 800, color: C.gray900 }}>₹{Math.ceil((rescheduleAppt.total_fee || 0) * 0.15)}</span>
              </div>
              <p style={{ fontSize: ".7rem", color: C.gray400 }}>Pay via Razorpay to confirm new date</p>
            </div>

            <Btn 
              full 
              disabled={!rescheduleDate || !rescheduleTime || rescheduleLoading} 
              onClick={async () => {
                const fee = Math.ceil((rescheduleAppt.total_fee || 0) * 0.15);
                setRescheduleLoading(true);
                try {
                  // Load Razorpay checkout script if not already loaded
                  await new Promise((resolve, reject) => {
                    if (window.Razorpay) return resolve();
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load payment gateway. Check your internet connection."));
                    document.body.appendChild(script);
                  });

                  const order = await createRazorpayOrder({ amount: fee, currency: "INR", receipt: `resch_${rescheduleAppt._id}` }, token);
                  const options = {
                    key: order.keyId, amount: order.amount, currency: order.currency, name: "Tym4DOC Reschedule", description: "Appointment Rescheduling Fee", order_id: order.orderId,
                    handler: async (response) => {
                      await verifyPayment({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }, token);
                        handleRescheduleSuccess(rescheduleAppt._id, { 
                        newDate: rescheduleDate, 
                        newTime: rescheduleTime, 
                        patientAge: bookingAge,
                        patientAddress: bookingAddress,
                        patientGender: bookingGender,
                        paymentOrderId: response.razorpay_order_id, 
                        paymentId: response.razorpay_payment_id, 
                        paymentSignature: response.razorpay_signature, 
                        amount: order.amount 
                      });
                    },
                    theme: { color: C.blue },
                    modal: { ondismiss: () => setRescheduleLoading(false) }
                  };
                  const rzp = new window.Razorpay(options);
                  rzp.open();
                } catch (err) { showMsg(err.message || "Rescheduling payment failed"); setRescheduleLoading(false); }
              }}
            >
              {rescheduleLoading ? "Processing..." : `Pay ₹${Math.ceil((rescheduleAppt.total_fee || 0) * 0.15)} & Reschedule`}
            </Btn>
          </div>
        </div>
      )}
      {!isGuest && (
        <>
          <SupportFAB onClick={() => setSupportModalOpen(true)} />
          <SupportModal 
            isOpen={supportModalOpen} 
            onClose={() => setSupportModalOpen(false)} 
            token={token}
          />
        </>
      )}
    </div>
  );
}
