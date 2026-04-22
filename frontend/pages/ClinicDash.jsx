// Fix duplicate declaration
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useAppointment } from "../context/AppointmentContext";
import s from "../constants/styles";
import C from "../constants/colors";
import useResponsive from "../hooks/useResponsive";
import VerificationNotice from "./VerificationNotice";
import { addDoctorClinic, getMyDoctorsClinic, deleteDoctorClinic, updateDoctorClinic, getSpecialties, rejectAppointment, completeAppointment, changePassword, updateClinicProfile, getMyProfile, sendAppointmentReminder } from "../services/api";
import { loadAppts } from "../utils/appointmentHelpers";
import PhotoUpload from "../components/shared/PhotoUpload";
import CalendarPicker from "../components/shared/CalendarPicker";
import { Btn, Bdg, Inp } from "../components/shared/UI";
import SupportModal, { SupportFAB } from "../components/shared/SupportModal";
import { useSearchParams, useNavigate } from "react-router-dom";
import { formatSlotRange } from "../utils/timeUtils";

function ScrollWheel({ options, value, onChange, height = 150, ...props }) {
  const itemHeight = 40;
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      const idx = options.indexOf(value);
      listRef.current.scrollTop = idx * itemHeight;
    }
  }, [value, options]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const idx = Math.round(listRef.current.scrollTop / itemHeight);
    if (options[idx] !== undefined && options[idx] !== value) {
      onChange(options[idx]);
    }
  };

  return (
    <div 
      ref={listRef}
      onScroll={handleScroll}
      style={{ 
        height, overflowY: "scroll", scrollSnapType: "y mandatory", 
        border: `1px solid ${C.gray200}`, borderRadius: 8, background: "#f9f9f9", 
        width: 60, textAlign: "center", scrollbarWidth: "none", msOverflowStyle: "none" 
      }}
    >
      <div style={{ height: (height - itemHeight) / 2 }} />
      {options.map(opt => (
        <div 
          key={opt} 
          style={{ 
            height: itemHeight, lineHeight: `${itemHeight}px`, scrollSnapAlign: "center",
            fontSize: "1.2rem", fontWeight: value === opt ? 800 : 400, 
            color: value === opt ? C.blue : C.gray400, transition: "all .2s"
          }}
        >
          {props.renderLabel ? props.renderLabel(opt) : opt}
        </div>
      ))}
      <div style={{ height: (height - itemHeight) / 2 }} />
    </div>
  );
}

function WheelTimePicker({ value, onChange, label, shiftType, hideAMPM }) {
  const [showModal, setShowModal] = useState(false);
  const R = useResponsive();
  
  const sanitize = (val) => {
    if (!val) return null;
    const parts = val.split(/[: ]/);
    let h = parseInt(parts[0]) || 0;
    let m = parseInt(parts[1]) || 0;
    const mer = parts[2];
    if (mer === "PM" && h !== 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const currentVal = sanitize(value) || (shiftType === "morning" ? "08:00" : shiftType === "afternoon" ? "12:00" : shiftType === "evening" ? "16:00" : "20:00");
  const [hStr, mStr] = currentVal.split(":");
  
  const [tempH, setTempH] = useState(hStr);
  const [tempM, setTempM] = useState(mStr);

  const hourOptions = useMemo(() => {
    if (shiftType === "morning") return Array.from({length: 12}, (_, i) => String(i).padStart(2, "0"));
    if (shiftType === "afternoon") return Array.from({length: 4}, (_, i) => String(i + 12).padStart(2, "0"));
    if (shiftType === "evening") return Array.from({length: 4}, (_, i) => String(i + 16).padStart(2, "0"));
    if (shiftType === "night") return Array.from({length: 4}, (_, i) => String(i + 20).padStart(2, "0"));
    return Array.from({length: 24}, (_, i) => String(i).padStart(2, "0"));
  }, [shiftType]);

  const minuteOptions = useMemo(() => Array.from({length: 60}, (_, i) => String(i).padStart(2, "0")), []);

  useEffect(() => {
    if (showModal) {
      const initialH = hourOptions.includes(hStr) ? hStr : hourOptions[0];
      const initialM = minuteOptions.includes(mStr) ? mStr : "00";
      setTempH(initialH);
      setTempM(initialM);
    }
  }, [showModal, hStr, mStr, hourOptions, minuteOptions]);

  const fmt12 = (val) => {
    if (!val) return "00:00";
    const [h, m] = val.split(":");
    let hh = parseInt(h);
    const mmm = m || "00";
    if (hideAMPM) return `${String(hh).padStart(2, "0")}:${mmm}`;
    const mer = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    return `${String(hh).padStart(2, "0")}:${mmm} ${mer}`;
  };

  return (
    <>
      <div 
        onClick={() => setShowModal(true)}
        style={{ 
          background: "#333", color: "white", borderRadius: 8, padding: "8px 6px", 
          cursor: "pointer", fontSize: R.isMobile ? "0.75rem" : "0.85rem", flex: 1, minWidth: 0, textAlign: "center",
          border: `1px solid ${C.gray700}`, transition: "all .2s", fontWeight: 700
        }}
      >
        {fmt12(value)}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, width: 280, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", animation: "fadeSlideUp .3s" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 16, textAlign: "center", color: C.gray900 }}>{label}</h3>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 24, position: "relative" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: ".6rem", color: C.gray400, fontWeight: 800 }}>{hideAMPM ? "HOURS" : `HR (${parseInt(tempH) >= 12 ? "PM" : "AM"})`}</div>
                <ScrollWheel 
                  options={hourOptions} 
                  value={tempH} 
                  onChange={setTempH} 
                  renderLabel={(val) => {
                    const h = parseInt(val);
                    if (hideAMPM) return String(h).padStart(2, "0");
                    const displayH = h % 12 || 12;
                    return String(displayH).padStart(2, "0");
                  }}
                />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: C.blue, marginTop: 12 }}>:</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: ".6rem", color: C.gray400, fontWeight: 800 }}>{hideAMPM ? "MINS" : "MIN"}</div>
                <ScrollWheel options={minuteOptions} value={tempM} onChange={setTempM} />
              </div>
              <div style={{ position: "absolute", top: "58%", left: "50%", transform: "translate(-50%, -50%)", height: 40, width: "100%", pointerEvents: "none", borderTop: "2px solid rgba(0,102,255,0.1)", borderBottom: "2px solid rgba(0,102,255,0.1)", background: "rgba(0,102,255,0.02)" }} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.gray200}`, background: "none", fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onChange(`${tempH}:${tempM}`);
                  setShowModal(false);
                }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: C.blue, color: C.white, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
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
        padding: 24,
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

function MiniApptCard({ appt }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: C.white, border: `1px solid ${C.gray100}`, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: ".85rem", fontWeight: 700, color: C.gray800 }}>{appt.patientName}</div>
        {appt.patientId && (
          <div style={{ fontSize: ".68rem", color: C.blue, fontWeight: 700, marginTop: 2 }}>
             Account: {appt.patientId.firstName} {appt.patientId.lastName}
          </div>
        )}
        <div style={{ fontSize: ".75rem", color: C.gray500, marginTop: 2 }}>{formatSlotRange(appt.time, appt.slotDuration)} · {appt.reason || "General Consultation"}</div>
      </div>
      <span style={{ fontSize: ".7rem", fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: appt.status === "approved" ? "#dcfce7" : "#fef3c7", color: appt.status === "approved" ? "#166534" : "#92400e", textTransform: "uppercase" }}>
        {appt.status}
      </span>
    </div>
  );
}

export default function ClinicDash() {
  const formatTime12 = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    let hh = parseInt(h);
    const mmm = m || "00";
    const mer = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    return `${hh}:${mmm} ${mer}`;
  };

  const { session, token, loggedInClinic, showToast, logout, refreshProfile } = useAuth();
  const { appointments, setAppts, rejectAppt, initSocketListeners } = useAppointment();
  const R = useResponsive();
  
  // Guard for email verification (clinics only)
  if (session?.role === "clinic" && !session?.isEmailVerified) {
    return (
      <>
        <VerificationNotice />
        <SupportFAB onClick={() => setSupportModalOpen(true)} />
        <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} token={token} />
      </>
    );
  }

  // Guard: If authenticated but role isn't clinic, redirect away
  if (session?.role && session.role !== "clinic") {
    setTimeout(() => {
      if (session.role === "patient") navigate("/patient/dashboard");
      else if (session.role === "admin") navigate("/admin/dashboard");
    }, 0);
    return null;
  }
  const getLocalDayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isPastOrCurrentSlot = (apptDate, apptTime) => {
    const todayVal = getLocalDayStr();
    if (apptDate < todayVal) return true;
    if (apptDate > todayVal) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [h, m] = apptTime.split(":").map(Number);
    return nowMins >= (h * 60 + m);
  };
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [internalTab, setInternalTab] = useState(() => searchParams.get("tab") || "Dashboard");
  const [selectedDoctorId, setSelectedDoctorId] = useState(() => searchParams.get("doctorId") || null);

  useEffect(() => {
    const pTab = searchParams.get("tab") || "Dashboard";
    const pDocId = searchParams.get("doctorId") || null;
    if (pTab !== internalTab) setInternalTab(pTab);
    if (pDocId !== selectedDoctorId) setSelectedDoctorId(pDocId);
  }, [searchParams]);

  const setTab = (newTab, replace = false) => {
    setInternalTab(newTab);
    const params = { tab: newTab };
    const pDoctorId = searchParams.get("doctorId");
    if (pDoctorId) params.doctorId = pDoctorId;
    setSearchParams(params, { replace });
  };

  const setDocNav = (id) => {
    setSelectedDoctorId(id);
    setSearchParams({ tab: internalTab, doctorId: id });
  };

  const tab = internalTab;
  const [doctors, setDoctors] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [remindAppt, setRemindAppt] = useState(null);
  const [remindMode, setRemindMode] = useState("Email");
  const [toast, setToast] = useState("");
  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const emptyForm = {
    firstName:"", lastName:"", email:"", phone:"", gender:"Male",
    degree:"MBBS", specialty:"", expertise: "", regNo:"", college:"", exp:"", fee:"500", bio:"",
    morningSlots: "0", afternoonSlots: "0", eveningSlots: "0", nightSlots: "0",
    slotDuration: "30",
    password: "",
    available: true, unavailableUntil: "", photoUrl: "",
    morningStartTime: "08:00", morningEndTime: "12:00",
    afternoonStartTime: "12:00", afternoonEndTime: "16:00",
    eveningStartTime: "16:00", eveningEndTime: "20:00",
    nightStartTime: "20:00", nightEndTime: "23:59",
    morningActive: true, afternoonActive: true, eveningActive: true, nightActive: true,
    tomorrowBookingCutoffTime: "", bookingCutoffDay: "previous_day",
    slotBookingOffset: ""
  };
  const [docForm, setDocForm] = useState(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showUnavailPicker, setShowUnavailPicker] = useState(null); 
  const [unavailDateState, setUnavailDateState] = useState("");
  const [rejectingApptId, setRejectingApptId] = useState(null);
  const [rejectDate, setRejectDate] = useState("");
  const [rejectTime, setRejectTime] = useState("");
  const [showRejectCalendar, setShowRejectCalendar] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [dbSpecialties, setDbSpecialties] = useState([]);

  const [apptSearch, setApptSearch] = useState("");
  const [apptDateFilter, setApptDateFilter] = useState("Today"); 
  const [customApptDate, setCustomApptDate] = useState("");
  const [showApptCalendar, setShowApptCalendar] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilter, setDetailFilter] = useState("Today");
  const [detailDate, setDetailDate] = useState("");
  const [showDetailCalendar, setShowDetailCalendar] = useState(false);
  const [drillDownDate, setDrillDownDate] = useState("");
  const [showDrillDownCalendar, setShowDrillDownCalendar] = useState(false);

  // Settings state
  const [cpName, setCpName] = useState("");
  const [cpPhone, setCpPhone] = useState("");
  const [cpAddress, setCpAddress] = useState("");
  const [cpCity, setCpCity] = useState("");
  const [cpState, setCpState] = useState("");
  const [cpDesc, setCpDesc] = useState("");
  const [cpEmail, setCpEmail] = useState("");
  const [cpMaxBookingDays, setCpMaxBookingDays] = useState(7);
  const [cpProfLoading, setCpProfLoading] = useState(false);
  const [chCurrent, setChCurrent] = useState("");
  const [chNew, setChNew] = useState("");
  const [chConfirm, setChConfirm] = useState("");
  const [chLoading, setChLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  useEffect(() => {
    if (token && loggedInClinic?.status === "approved") {
      setLoadingDocs(true);
      getSpecialties().then(res => setDbSpecialties(Array.isArray(res) ? res : [])).catch(() => {});
      getMyDoctorsClinic(token)
        .then(res => { setDoctors(Array.isArray(res) ? res : []); })
        .catch((err) => { if (showToast) showToast("Failed to load doctors. Please refresh.", true); })
        .finally(() => setLoadingDocs(false));
      loadAppts("clinic", token, setAppts).catch(() => {});
    }
  }, [token, loggedInClinic?.status, setAppts]);

  // Separate useEffect for socket listeners so cleanup runs correctly
  useEffect(() => {
    if (token && session?._id && loggedInClinic?.status === "approved") {
      const cleanup = initSocketListeners("clinic", session._id, token);
      return cleanup;
    }
  }, [token, session?._id, loggedInClinic?.status, initSocketListeners]);

  const completeAppt = async (id) => {
    try {
      await completeAppointment(id, token);
      loadAppts("clinic", token, setAppts);
    } catch (err) { alert(err.message || "Error completing appointment"); }
  };

  const handleDocChange = k => e => {
    let val = e.target.value;
    if (k === 'available') val = val === 'true';
    if (k === 'phone') val = val.replace(/\D/g, "").slice(0, 10);
    setDocForm(p => ({...p, [k]: val}));
  };

  const handleAddDoctor = async () => {
    if (!docForm.firstName || !docForm.lastName || !docForm.degree || !docForm.specialty || !docForm.regNo || !docForm.exp || !docForm.phone || (!editingDoc && !docForm.password)) {
      alert("Please fill all required fields (Name, Phone, Password, Degree, Specialty, RegNo, Experience).");
      return;
    }
    setAddLoading(true);
    try {
      if (editingDoc) {
        const res = await updateDoctorClinic(editingDoc._id, docForm, token);
        setDoctors(prev => prev.map(d => d._id === editingDoc._id ? (res.doctor || { ...d, ...docForm }) : d));
        setEditingDoc(null);
      } else {
        const res = await addDoctorClinic(docForm, token);
        setDoctors(prev => [...prev, res.doctor]);
      }
      setDocForm(emptyForm);
      setShowDocForm(false);
    } catch (err) { alert(err.message || "Error saving doctor"); }
    setAddLoading(false);
  };

  const handleEditDoctor = (doc) => {
    if (!doc) return;
    setEditingDoc(doc);
    setDocForm({
      firstName: doc.firstName || "", lastName: doc.lastName || "", email: doc.email || "",
      phone: doc.phone || "", gender: doc.gender || "Male", degree: doc.degree || "MBBS",
      specialty: doc.specialty || "", regNo: doc.regNo || "", college: doc.college || "",
      exp: String(doc.exp || "0"), fee: String(doc.fee || "500"), bio: doc.bio || "",
      morningSlots: String(doc.morningSlots ?? 3), afternoonSlots: String(doc.afternoonSlots ?? 3),
      eveningSlots: String(doc.eveningSlots ?? 3), nightSlots: String(doc.nightSlots ?? 0),
      slotDuration: String(doc.slotDuration ?? 30),
      available: doc.available !== false, unavailableUntil: doc.unavailableUntil ? doc.unavailableUntil.split("T")[0] : "",
      photoUrl: doc.photoUrl || "",
      morningStartTime: doc.morningStartTime || "08:00", morningEndTime: doc.morningEndTime || "12:00",
      afternoonStartTime: doc.afternoonStartTime || "12:00", afternoonEndTime: doc.afternoonEndTime || "16:00",
      eveningStartTime: doc.eveningStartTime || "16:00", eveningEndTime: doc.eveningEndTime || "20:00",
      nightStartTime: doc.nightStartTime || "20:00", nightEndTime: doc.nightEndTime || "23:59",
      morningActive: doc.morningActive !== false,
      afternoonActive: doc.afternoonActive !== false,
      eveningActive: doc.eveningActive !== false,
      nightActive: doc.nightActive !== false,
      tomorrowBookingCutoffTime: doc.tomorrowBookingCutoffTime || "",
      bookingCutoffDay: doc.bookingCutoffDay || "previous_day",
      slotBookingOffset: doc.slotBookingOffset || "",
      expertise: doc.expertise || "",
      password: ""
    });
    setShowDocForm(true);
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("Remove this doctor? This cannot be undone.")) return;
    try {
      await deleteDoctorClinic(id, token);
      setDoctors(prev => prev.filter(d => d._id !== id));
    } catch { alert("Error removing doctor"); }
  };

  const toggleAvailability = async (id, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const updateData = { available: newStatus };
      if (newStatus === true) updateData.unavailableUntil = null;
      await updateDoctorClinic(id, updateData, token);
      setDoctors(prev => prev.map(d => d._id === id ? { ...d, ...updateData } : d));
    } catch { alert("Error updating status"); }
  };

  const setUnavailableDate = async (id, date) => {
    try {
      await updateDoctorClinic(id, { available: false, unavailableUntil: date }, token);
      setDoctors(prev => prev.map(d => d._id === id ? { ...d, available: false, unavailableUntil: date } : d));
    } catch { alert("Error setting date"); }
  };

  const totalDoctors = doctors.length;
  const totalAppts = appointments.length;
  const totalEarnings = appointments
    .filter(a => (a.status === "approved" || a.status === "completed") && !a.settled)
    .reduce((sum, a) => sum + (a.clinic_earning || 0), 0);

  if (!loggedInClinic || loggedInClinic.status === "pending") {
    return (
      <div style={{ flex:1, display:"flex", flexDirecton: "column", height: "100vh", background: C.gray50 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <AnimCard style={{ textAlign:"center", maxWidth:450, width:"100%" }}>
            <h2 style={{ fontWeight:800, marginBottom:8 }}>Application Under Review</h2>
            <p style={{ color:C.gray500, fontSize:".9rem" }}>Your clinic registration is pending admin approval.</p>
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: "8px 12px", fontSize: ".8rem", color: "#92400e", fontWeight: 600, marginTop:16 }}>Status: Pending Verification</div>
          </AnimCard>
        </div>
        <SupportFAB onClick={() => setSupportModalOpen(true)} />
        <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} token={token} />
      </div>
    );
  }

  if (loggedInClinic?.status === "rejected") {
    return (
      <div style={{ flex:1, display:"flex", flexDirection: "column", height: "100vh", background: C.gray50 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <AnimCard style={{ textAlign:"center", maxWidth:450, width:"100%", borderColor: "#fca5a5" }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 800, margin: "0 auto 16px" }}>X</div>
            <h2 style={{ fontWeight:800, color: "#991b1b", marginBottom:8 }}>Application Rejected</h2>
            <p style={{ color:C.gray600, fontSize:".95rem", lineHeight: 1.5 }}>We're sorry, but your clinic registration has been declined by the administration.</p>
            <div style={{ background: "#fee2e2", border: "1px solid #f87171", borderRadius: 6, padding: "10px 14px", fontSize: ".85rem", color: "#991b1b", fontWeight: 700, marginTop:20 }}>Status: Rejected</div>
          </AnimCard>
        </div>
        <SupportFAB onClick={() => setSupportModalOpen(true)} />
        <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} token={token} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.gray50, color: C.gray900 }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: C.gray900, color: C.white, padding: "14px 22px", borderRadius: 8, fontSize: ".88rem", fontWeight: 700, boxShadow: "0 8px 16px rgba(0,0,0,.15)", animation: "fadeSlideUp .3s both" }}>
          {toast}
        </div>
      )}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: R.isMobile ? "24px 16px" : "32px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: R.isMobile ? "1.4rem" : "1.8rem", fontWeight: 800, color: C.gray900, marginBottom: 6 }}>{loggedInClinic.name}</h1>
            <p style={{ color: C.gray500, fontSize: ".9rem" }}>Dashboard and Clinic Management</p>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: R.isMobile ? "1fr" : "repeat(3, 1fr)", 
            gap: 12, 
            flexGrow: R.isMobile ? 1 : 0, 
            width: "100%" 
          }}>
            <StatCard label="Doctors" value={totalDoctors} />
            <StatCard label="Total Appts" value={totalAppts} />
            <StatCard label="Earnings" value={`Rs.${totalEarnings.toFixed(0)}`} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: R.isMobile ? "20px 16px" : "32px 20px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: R.width < 480 ? "1fr" : "repeat(auto-fit, minmax(100px, 1fr))",
          background: C.gray100, 
          borderRadius: 8, 
          padding: 4, 
          gap: 4, 
          marginBottom: 32 
        }}>
          {["Dashboard", "Manage Doctors", "Appointments", "Settings"].map(t => (
            <button 
              key={t} onClick={() => setTab(t)} 
              style={{ 
                padding: "12px 8px", border: "none", fontFamily: "inherit", fontWeight: 700, 
                fontSize: R.width < 350 ? ".75rem" : ".85rem", cursor: "pointer", borderRadius: 6, 
                background: tab === t ? C.blue : "transparent", color: tab === t ? C.white : C.gray500, 
                transition: "all .2s ease",
                textAlign: "center",
                wordBreak: "break-word",
                whiteSpace: "normal"
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Dashboard" && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            {selectedDoctorId ? (() => {
              const d = doctors.find(doc => doc._id === selectedDoctorId);
              if (!d) { 
                if (loadingDocs) return <div style={{ padding: 40, textAlign: "center", color: C.gray500, fontWeight: 700 }}>Loading doctor details...</div>;
                setTimeout(() => setSelectedDoctorId(null), 0); 
                return null; 
              }

              const doctorAppts = appointments.filter(a => (a.doctorId?._id || a.doctorId) === d._id);

              return (
                <div style={{ animation: "fadeSlideUp .3s both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <button 
                      onClick={() => window.history.back()} 
                      style={{ background: "none", border: "none", color: C.blue, fontWeight: 700, cursor: "pointer", fontSize: ".9rem", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
                    >
                      ← Back to List
                    </button>
                  </div>

                  <AnimCard style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <div style={{ width: 64, height: 64, borderRadius: 10, background: C.gray100, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.gray500, overflow: "hidden" }}>
                          {d.photoUrl ? <img src={d.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : `${d.firstName[0]}${d.lastName[0]}`}
                        </div>
                        <div>
                          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: C.gray900 }}>Dr. {d.firstName} {d.lastName}</h2>
                          <p style={{ color: C.gray500, fontSize: ".88rem", marginTop: 2 }}>{d.specialty} {d.expertise ? `(${d.expertise})` : ""} · {d.degree}</p>
                        </div>
                      </div>
                      <Btn onClick={() => { handleEditDoctor(d); setTab("Manage Doctors"); }} style={{ width: R.isMobile ? "100%" : "auto" }}>Edit Doctor Profile</Btn>
                    </div>
                  </AnimCard>

                  <div className="search-box-wrap" style={{ background: C.white, padding: 16, borderRadius: 12, border: `1px solid ${C.gray200}`, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <input style={{ ...s.inp, marginBottom: 0, flex: 1, minWidth: 200 }} placeholder="Search patient..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["Today", "Yesterday", "Tomorrow", "All"].map(f => (
                        <button key={f} onClick={() => { setDetailFilter(f); setShowDetailCalendar(false); }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: detailFilter === f ? C.blue : C.gray100, color: detailFilter === f ? C.white : C.gray700, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}>{f}</button>
                      ))}
                      <button onClick={() => setShowDetailCalendar(!showDetailCalendar)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: detailFilter === "Custom" ? C.blue : C.gray100, color: detailFilter === "Custom" ? C.white : C.gray700, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}>Calendar</button>
                    </div>
                  </div>

                  {showDetailCalendar && (
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, animation: "fadeSlideUp .3s" }}>
                      <CalendarPicker selectedDate={detailDate} onSelect={(dt) => { setDetailDate(dt); setDetailFilter("Custom"); setShowDetailCalendar(false); }} />
                    </div>
                  )}

                  <div>
                    {(() => {
                      const getRelativeDate = (offset) => {
                        const date = new Date(); date.setDate(date.getDate() + offset);
                        return getLocalDayStr(date);
                      };
                      
                      const filtered = doctorAppts.filter(a => {
                        const patName = (a.patientName || (typeof a.patientId === "object" && a.patientId?.firstName ? `${a.patientId.firstName} ${a.patientId.lastName}` : "")).toLowerCase();
                        if (detailSearch && !patName.includes(detailSearch.toLowerCase())) return false;
                        
                        if (detailFilter === "Today") return a.date === getLocalDayStr();
                        if (detailFilter === "Yesterday") return a.date === getRelativeDate(-1);
                        if (detailFilter === "Tomorrow") return a.date === getRelativeDate(1);
                        if (detailFilter === "Custom" && detailDate) return a.date === detailDate;
                        return true;
                      });

                      if (filtered.length === 0) return <p style={{ textAlign: "center", padding: 40, color: C.gray500 }}>No appointments found.</p>;

                      return (
                        <div style={{ overflowX:"auto", background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, animation: "fadeSlideUp .3s both" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                            <thead>
                              <tr style={{ background: C.gray50 }}>
                                <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Patient / Account</th>
                                <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Demographics</th>
                                <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Reason</th>
                                <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Appt Date/Time</th>
                                <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((a, i) => (
                                <tr key={a._id || a.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                                  <td style={s.td}>
                                    <div style={{ fontWeight: 800, color: C.gray900 }}>{a.patientName}</div>
                                    <div style={{ fontSize: ".76rem", color: C.blue, fontWeight: 700, marginTop: 2 }}>
                                      {typeof a.patientId === "object" ? `${a.patientId.firstName} ${a.patientId.lastName}` : "Registered Patient"}
                                    </div>
                                    <div style={{ fontSize: ".8rem", color: C.blue, fontWeight: 700, marginTop: 4 }}>{a.patientPhone || "No Phone"}</div>
                                  </td>
                                  <td style={s.td}>
                                    <div style={{ fontSize: ".8rem", color: C.gray700 }}>
                                      Age: {a.patientAge || "N/A"} · {a.patientGender || "N/A"}
                                      <br/><span style={{ fontSize: ".75rem" }}>Addr: {a.patientAddress || "No address"}</span>
                                    </div>
                                  </td>
                                  <td style={s.td}>
                                    <div style={{ fontSize: ".8rem", color: C.gray600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }} title={a.reason}>{a.reason || "—"}</div>
                                  </td>
                                  <td style={s.td}>
                                    <div style={{ fontWeight: 700, color: C.gray900 }}>{a.date}</div>
                                    <div style={{ fontSize: ".75rem", color: C.blue, fontWeight: 700 }}>{formatSlotRange(formatTime12(a.time), a.slotDuration)}</div>
                                    <Bdg size="sm" type={a.status === "completed" || a.status === "approved" ? "green" : "blue"}>{a.status}</Bdg>
                                  </td>
                                  <td style={s.td}>
                                    <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                                      {a.status === "approved" && isPastOrCurrentSlot(a.date, a.time) && (
                                        <button onClick={() => { if(window.confirm("Mark as completed?")) completeAppt(a._id || a.id); }} style={{ padding: "6px 12px", background: C.green, color: C.white, border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: ".75rem" }}>Mark Completed</button>
                                      )}
                                      {(a.status === "approved" && a.date >= getLocalDayStr()) && (
                                        <button onClick={() => setRemindAppt(a)} style={{ padding: "6px 12px", background: C.white, color: C.blue, border: `1px solid ${C.gray200}`, borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: ".75rem" }}>Remind</button>
                                      )}
                                      {a.status === "approved" && a.date >= getLocalDayStr() && (
                                        <button onClick={() => setRejectingApptId(a._id || a.id)} style={{ padding: "6px 12px", background: C.white, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: ".75rem" }}>Cancel / Reschedule</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })() : (
              <>
                <SectionHead title="Your Doctors" sub="Quick overview of your listed specialists" />
                <div style={{ display:"grid", gridTemplateColumns: R.width < 900 ? "1fr" : "1fr 1fr", gap:16, width: "100%" }}>
                  {doctors.map((d, i) => (
                    <AnimCard key={d._id} delay={i * 0.04} onClick={() => setDocNav(d._id)} style={{ cursor: "pointer", padding: R.width < 380 ? "12px" : R.width < 480 ? "16px" : "24px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: R.width < 480 ? "column" : "row", gap: R.width < 380 ? 10 : 16, alignItems: R.width < 480 ? "flex-start" : "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexDirection: R.width < 480 ? "column" : "row", gap: R.width < 480 ? 12 : 16, alignItems: R.width < 480 ? "flex-start" : "center", flex: 1, minWidth: 0 }}>
                          <div style={{ width: R.width < 380 ? 46 : R.width < 480 ? 56 : 56, height: R.width < 380 ? 46 : R.width < 480 ? 56 : 56, borderRadius: 8, background: C.gray100, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.gray500, flexShrink: 0, overflow: "hidden" }}>
                            {d.photoUrl ? <img src={d.photoUrl} alt="" style={{width: "100%", height: "100%", objectFit: "cover"}} /> : `${d.firstName[0]}${d.lastName[0]}`}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
                            <strong style={{ fontSize: R.width < 380 ? ".95rem" : "1.05rem", color: C.gray900, display: "block", wordBreak: "break-word" }}>
                              Dr. {d.firstName} {d.lastName}
                            </strong>
                            <p style={{ fontSize: R.width < 380 ? ".75rem" : ".82rem", color: C.gray500, marginTop: 4, lineHeight: 1.4 }}>
                              {d.specialty} · {d.degree} · {d.exp} yrs · Rs.{d.fee}
                            </p>
                          </div>
                        </div>
                        <div style={{ 
                          flexShrink: 0, 
                          position: R.width < 480 ? "absolute" : "static", 
                          top: R.width < 480 ? 16 : "auto", 
                          right: R.width < 480 ? 16 : "auto" 
                        }}>
                          <span style={{
                            background: (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "#dcfce7" : "#fee2e2", 
                            color: (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "#166534" : "#991b1b",
                            padding: R.width < 380 ? "4px 8px" : "4px 12px", borderRadius: 20, fontSize: R.width < 380 ? ".65rem" : ".7rem", fontWeight: 700, whiteSpace: "nowrap"
                          }}>
                            { (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "Active" : "Inactive" }
                          </span>
                        </div>
                      </div>
                    </AnimCard>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "Manage Doctors" && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <SectionHead title={`Listed Doctors (${doctors?.length || 0})`} sub="Manage and edit your doctor list" />
              <Btn onClick={() => { setShowDocForm(true); setEditingDoc(null); setDocForm(emptyForm); }}>+ Add New Doctor</Btn>
            </div>

            {showDocForm && (
              <AnimCard style={{ marginBottom:32, position: "relative" }}>
                <button onClick={() => setShowDocForm(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: C.red }}>X</button>
                <SectionHead title={editingDoc ? "Edit Doctor" : "Add New Doctor"} />

                <form onSubmit={(e) => { e.preventDefault(); handleAddDoctor(); }}>
                  <div style={{ marginBottom: 20 }}>
                    <PhotoUpload 
                      value={docForm.photoUrl} 
                      onChange={(url) => setDocForm(p => ({ ...p, photoUrl: url }))} 
                    />
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap:16, marginBottom:20 }}>
                    <div><label style={s.lbl}>First Name *</label><input style={s.inp} value={docForm.firstName} onChange={handleDocChange("firstName")} /></div>
                    <div><label style={s.lbl}>Last Name *</label><input style={s.inp} value={docForm.lastName} onChange={handleDocChange("lastName")} /></div>
                    <div><label style={s.lbl}>Email</label><input type="email" style={s.inp} value={docForm.email} onChange={handleDocChange("email")} /></div>
                    <div><label style={s.lbl}>Phone *</label><input type="tel" maxLength="10" style={s.inp} value={docForm.phone} onChange={handleDocChange("phone")} /></div>

                    <div>
                      <label style={s.lbl}>Degree *</label>
                      <input 
                        style={s.inp} 
                        value={docForm.degree} 
                        onChange={handleDocChange("degree")} 
                        placeholder="e.g. MBBS, MD, MS" 
                      />
                    </div>

                    <div>
                      <label style={s.lbl}>Specialty *</label>
                      <select value={docForm.specialty} onChange={handleDocChange("specialty")} style={s.inp}>
                        <option value="">-- Select Specialty --</option>
                        {dbSpecialties.length > 0 
                          ? dbSpecialties.map(sp => <option key={sp._id} value={sp.name}>{sp.name}</option>)
                          : SPECIALTIES.map(sp => <option key={sp} value={sp}>{sp}</option>)
                        }
                      </select>
                    </div>

                    <div>
                      <label style={s.lbl}>Expertise (e.g. Retina, Cataract)</label>
                      <input 
                        style={s.inp} 
                        value={docForm.expertise} 
                        onChange={handleDocChange("expertise")} 
                        placeholder="Specific sub-specialties" 
                      />
                    </div>

                    <div><label style={s.lbl}>Reg. Number *</label><input style={s.inp} value={docForm.regNo} onChange={handleDocChange("regNo")} /></div>
                    <div><label style={s.lbl}>College</label><input style={s.inp} value={docForm.college} onChange={handleDocChange("college")} /></div>
                    <div><label style={s.lbl}>Experience (years) *</label><input type="number" style={s.inp} value={docForm.exp} onChange={handleDocChange("exp")} /></div>
                    <div><label style={s.lbl}>Consultation Fee (Rs) *</label><input type="number" style={s.inp} value={docForm.fee} onChange={handleDocChange("fee")} /></div>
                    
                    <div>
                      <label style={s.lbl}>Gender</label>
                      <select value={docForm.gender} onChange={handleDocChange("gender")} style={s.inp}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <Inp label={`Password ${editingDoc ? "(Leave blank to keep same)" : "*"}`} type="password" value={docForm.password} onChange={handleDocChange("password")} placeholder={editingDoc ? "Keep same password" : "Min. 8 characters"} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 24, paddingTop: 16, borderTop: `1px solid ${C.gray100}` }}>
                      <label style={{ ...s.lbl, fontSize: ".9rem", marginBottom: 6 }}>Doctor Slots Allocation</label>
                      <div style={{ display:"grid", gridTemplateColumns: R.isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
                        
                        <div style={{ background: C.gray100, padding: 12, borderRadius: 10, border: `1px solid ${C.gray200}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ ...s.lbl, fontSize: ".7rem", textTransform: "uppercase", marginBottom: 0 }}>Morning Range</label>
                            <button type="button" onClick={() => setDocForm(p => ({...p, morningActive: !p.morningActive}))} style={{ padding: "4px 12px", fontSize: ".7rem", fontWeight: 800, borderRadius: 6, border: "none", background: docForm.morningActive ? C.blue : C.gray200, color: docForm.morningActive ? C.white : C.gray600, cursor: "pointer", transition: "all .2s" }}>
                              {docForm.morningActive ? "ON" : "OFF"}
                            </button>
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems: "center", marginTop: 4, opacity: docForm.morningActive ? 1 : 0.4, pointerEvents: docForm.morningActive ? "auto" : "none" }}>
                            <WheelTimePicker shiftType="morning" label="Morning Start" value={docForm.morningStartTime} onChange={(val) => setDocForm(p => ({...p, morningStartTime: val}))} />
                            <span style={{ color: C.gray400, fontSize: ".8rem" }}>to</span>
                            <WheelTimePicker shiftType="morning" label="Morning End" value={docForm.morningEndTime} onChange={(val) => setDocForm(p => ({...p, morningEndTime: val}))} />
                          </div>
                        </div>

                        <div style={{ background: C.gray100, padding: 12, borderRadius: 10, border: `1px solid ${C.gray200}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ ...s.lbl, fontSize: ".7rem", textTransform: "uppercase", marginBottom: 0 }}>Afternoon Range</label>
                            <button type="button" onClick={() => setDocForm(p => ({...p, afternoonActive: !p.afternoonActive}))} style={{ padding: "4px 12px", fontSize: ".7rem", fontWeight: 800, borderRadius: 6, border: "none", background: docForm.afternoonActive ? C.blue : C.gray200, color: docForm.afternoonActive ? C.white : C.gray600, cursor: "pointer", transition: "all .2s" }}>
                              {docForm.afternoonActive ? "ON" : "OFF"}
                            </button>
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems: "center", marginTop: 4, opacity: docForm.afternoonActive ? 1 : 0.4, pointerEvents: docForm.afternoonActive ? "auto" : "none" }}>
                            <WheelTimePicker shiftType="afternoon" label="Afternoon Start" value={docForm.afternoonStartTime} onChange={(val) => setDocForm(p => ({...p, afternoonStartTime: val}))} />
                            <span style={{ color: C.gray400, fontSize: ".8rem" }}>to</span>
                            <WheelTimePicker shiftType="afternoon" label="Afternoon End" value={docForm.afternoonEndTime} onChange={(val) => setDocForm(p => ({...p, afternoonEndTime: val}))} />
                          </div>
                        </div>

                        <div style={{ background: C.gray100, padding: 12, borderRadius: 10, border: `1px solid ${C.gray200}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ ...s.lbl, fontSize: ".7rem", textTransform: "uppercase", marginBottom: 0 }}>Evening Range</label>
                            <button type="button" onClick={() => setDocForm(p => ({...p, eveningActive: !p.eveningActive}))} style={{ padding: "4px 12px", fontSize: ".7rem", fontWeight: 800, borderRadius: 6, border: "none", background: docForm.eveningActive ? C.blue : C.gray200, color: docForm.eveningActive ? C.white : C.gray600, cursor: "pointer", transition: "all .2s" }}>
                              {docForm.eveningActive ? "ON" : "OFF"}
                            </button>
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems: "center", marginTop: 4, opacity: docForm.eveningActive ? 1 : 0.4, pointerEvents: docForm.eveningActive ? "auto" : "none" }}>
                            <WheelTimePicker shiftType="evening" label="Evening Start" value={docForm.eveningStartTime} onChange={(val) => setDocForm(p => ({...p, eveningStartTime: val}))} />
                            <span style={{ color: C.gray400, fontSize: ".8rem" }}>to</span>
                            <WheelTimePicker shiftType="evening" label="Evening End" value={docForm.eveningEndTime} onChange={(val) => setDocForm(p => ({...p, eveningEndTime: val}))} />
                          </div>
                        </div>

                        <div style={{ background: C.gray100, padding: 12, borderRadius: 10, border: `1px solid ${C.gray200}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ ...s.lbl, fontSize: ".7rem", textTransform: "uppercase", marginBottom: 0 }}>Night Range</label>
                            <button type="button" onClick={() => setDocForm(p => ({...p, nightActive: !p.nightActive}))} style={{ padding: "4px 12px", fontSize: ".7rem", fontWeight: 800, borderRadius: 6, border: "none", background: docForm.nightActive ? C.blue : C.gray200, color: docForm.nightActive ? C.white : C.gray600, cursor: "pointer", transition: "all .2s" }}>
                              {docForm.nightActive ? "ON" : "OFF"}
                            </button>
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems: "center", marginTop: 4, opacity: docForm.nightActive ? 1 : 0.4, pointerEvents: docForm.nightActive ? "auto" : "none" }}>
                            <WheelTimePicker shiftType="night" label="Night Start" value={docForm.nightStartTime} onChange={(val) => setDocForm(p => ({...p, nightStartTime: val}))} />
                            <span style={{ color: C.gray400, fontSize: ".8rem" }}>to</span>
                            <WheelTimePicker shiftType="night" label="Night End" value={docForm.nightEndTime} onChange={(val) => setDocForm(p => ({...p, nightEndTime: val}))} />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 20, padding: 16, background: C.gray50, borderRadius: 8, display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                        <div>
                          <label style={s.lbl}>Slot Duration (minutes) *</label>
                          <input type="number" style={s.inp} value={docForm.slotDuration} onChange={handleDocChange("slotDuration")} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div>
                            <label style={s.lbl}>Booking Cutoff</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, background: C.white, border: `1px solid ${C.gray200}`, padding: "10px 12px", borderRadius: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <button type="button" onClick={() => setDocForm(p => ({...p, tomorrowBookingCutoffTime: p.tomorrowBookingCutoffTime ? "" : "20:00"}))} style={{ padding: "4px 8px", fontSize: ".7rem", fontWeight: 700, borderRadius: 4, border: "none", background: docForm.tomorrowBookingCutoffTime ? C.blue : C.gray200, color: docForm.tomorrowBookingCutoffTime ? C.white : C.gray600, cursor: "pointer" }}>
                                  {docForm.tomorrowBookingCutoffTime ? "ON" : "OFF"}
                                </button>
                                {docForm.tomorrowBookingCutoffTime ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: ".75rem", color: C.gray500, fontWeight: 700 }}>Stop accepting at</span>
                                    <WheelTimePicker shiftType="all" value={docForm.tomorrowBookingCutoffTime} onChange={(val) => setDocForm(p => ({...p, tomorrowBookingCutoffTime: val}))} />
                                    <span style={{ fontSize: ".75rem", color: C.gray500, fontWeight: 700 }}>on the</span>
                                    <select style={{...s.inp, padding: "4px 8px", fontSize: ".75rem", width: "auto"}} value={docForm.bookingCutoffDay} onChange={(e) => setDocForm(p => ({...p, bookingCutoffDay: e.target.value}))}>
                                      <option value="previous_day">Day Before Appt</option>
                                      <option value="same_day">Same Day as Appt</option>
                                    </select>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: ".8rem", color: C.gray400 }}>No cutoff set</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label style={s.lbl}>Limit Booking Before Slot Time</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, background: C.white, border: `1px solid ${C.gray200}`, padding: "10px 12px", borderRadius: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <button type="button" onClick={() => setDocForm(p => ({...p, slotBookingOffset: p.slotBookingOffset ? "" : "02:25"}))} style={{ padding: "4px 12px", fontSize: ".7rem", fontWeight: 800, borderRadius: 6, border: "none", background: docForm.slotBookingOffset ? C.blue : C.gray200, color: docForm.slotBookingOffset ? C.white : C.gray600, cursor: "pointer", transition: "all .2s" }}>
                                  {docForm.slotBookingOffset ? "ON" : "OFF"}
                                </button>
                                {docForm.slotBookingOffset ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: ".75rem", color: C.gray500, fontWeight: 700 }}>Stop taking bookings</span>
                                    <WheelTimePicker shiftType="all" hideAMPM={true} value={docForm.slotBookingOffset} onChange={(val) => setDocForm(p => ({...p, slotBookingOffset: val}))} />
                                    <span style={{ fontSize: ".75rem", color: C.gray500, fontWeight: 700 }}>before the slot starts</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: ".8rem", color: C.gray400 }}>No limit</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={s.lbl}>Bio</label>
                    <textarea style={{ ...s.inp, height: 80, padding: 12 }} value={docForm.bio} onChange={handleDocChange("bio")} />
                  </div>

                  <div style={{ display:"flex", gap:12 }}>
                    <Btn type="submit" full disabled={addLoading}>{addLoading ? "Saving..." : (editingDoc ? "Update Doctor" : "Add Doctor")}</Btn>
                    {editingDoc && <Btn full color="out" onClick={() => { setEditingDoc(null); setDocForm(emptyForm); setShowDocForm(false); }}>Cancel</Btn>}
                  </div>
                </form>
              </AnimCard>
            )}

            <div style={{ overflowX:"auto", background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
                <thead>
                  <tr style={{ background:"#edf2f7" }}>
                    <th style={s.th}>Photo</th>
                    <th style={s.th}>Doctor</th>
                    <th style={s.th}>Specialty</th>
                    <th style={s.th}>Degree</th>
                    <th style={s.th}>Reg No.</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Appts</th>
                    <th style={s.th}>Earnings</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map(d => {
                     const docAppts = appointments.filter(a => String(a.doctorId?._id || a.doctorId) === String(d._id));
                     const docEarnings = docAppts
                       .filter(a => a.status === "approved" || a.status === "completed")
                       .reduce((sum, a) => sum + (a.clinic_earning || 0), 0);
                     
                     return (
                       <tr key={d._id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                         <td style={{ ...s.td, textAlign: "center" }}>
                           <div style={{ width: 44, height: 44, borderRadius: 8, background: C.gray100, overflow: "hidden", border: `1px solid ${C.gray200}`, margin: "0 auto" }}>
                             {d.photoUrl ? <img src={d.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", fontWeight: 800, color: C.gray400 }}>{d.firstName[0]}{d.lastName[0]}</div>}
                           </div>
                         </td>
                         <td style={s.td}><strong style={{ color: C.gray900 }}>Dr. {d.firstName} {d.lastName}</strong></td>
                         <td style={s.td}>{d.specialty}</td>
                         <td style={s.td}>{d.degree}</td>
                         <td style={s.td}>{d.regNo}</td>
                         <td style={s.td}>
                           <span style={{
                             background: (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "#dcfce7" : "#fee2e2",
                             color: (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "#166534" : "#991b1b",
                             padding: "4px 10px", borderRadius: 4, fontSize: ".7rem", fontWeight: 700
                           }}>
                             { (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "Available" : "Unavailable" }
                           </span>
                         </td>
                         <td style={{ ...s.td, textAlign: "center", color: C.blue, fontWeight:700 }}>{docAppts.length}</td>
                         <td style={{ ...s.td, textAlign: "center", color: "#16a34a", fontWeight:700 }}>₹{docEarnings}</td>
                         <td style={s.td}>
                           <div style={{ display:"flex", gap:8 }}>
                             <button 
                               onClick={() => {
                                 const isCurrentlyActive = (d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false);
                                 if (!isCurrentlyActive) toggleAvailability(d._id, false); 
                                 else setShowUnavailPicker(d._id);
                               }}
                               style={{ padding: "4px 8px", background: "#d97706", color: C.white, border:"none", borderRadius: 4, fontSize: ".7rem", cursor: "pointer" }}
                             >
                               {(d.unavailableUntil ? getLocalDayStr(new Date(d.unavailableUntil)) <= getLocalDayStr() : d.available !== false) ? "Set Unavail" : "Set Avail"}
                             </button>
                             <button onClick={() => handleEditDoctor(d)} style={{ padding: "4px 8px", background: C.blue, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: ".7rem" }}>Edit</button>
                             <button onClick={() => handleDeleteDoctor(d._id)} style={{ padding: "4px 8px", background: C.red, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: ".7rem" }}>Remove</button>
                           </div>
                         </td>
                       </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Appointments" && (() => {
          const getRelativeDate = (offset) => {
            const d = new Date(); d.setDate(d.getDate() + offset);
            return getLocalDayStr(d);
          };
          const filteredAppts = appointments.filter(a => {
            const patName = a.patientName || (typeof a.patientId === "object" && a.patientId?.firstName ? `${a.patientId.firstName} ${a.patientId.lastName}` : "");
            if (apptSearch && !patName.toLowerCase().includes(apptSearch.toLowerCase())) return false;
            if (apptDateFilter === "Today") return a.date === getLocalDayStr();
            if (apptDateFilter === "Yesterday") return a.date === getRelativeDate(-1);
            if (apptDateFilter === "Tomorrow") return a.date === getRelativeDate(1);
            if (apptDateFilter === "Custom" && customApptDate) return a.date === customApptDate;
            return true;
          });

          return (
            <div style={{ animation: "fadeSlideUp .3s both" }}>
              <SectionHead title="Appointments" />
              <div className="search-box-wrap" style={{ background: C.white, padding: 16, borderRadius: 12, border: `1px solid ${C.gray200}`, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input id="appt-search" style={{ ...s.inp, marginBottom: 0, flex: 1 }} placeholder="Search patient..." value={apptSearch} onChange={e => setApptSearch(e.target.value)} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Today", "Yesterday", "Tomorrow", "All"].map(f => (
                    <button key={f} onClick={() => setApptDateFilter(f)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: apptDateFilter === f ? C.blue : C.gray100, color: apptDateFilter === f ? C.white : C.gray700, fontWeight: 700, cursor: "pointer" }}>{f}</button>
                  ))}
                  <button onClick={() => setShowApptCalendar(!showApptCalendar)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: apptDateFilter === "Custom" ? C.blue : C.gray100, color: apptDateFilter === "Custom" ? C.white : C.gray700, fontWeight: 700, cursor: "pointer" }}>Calendar</button>
                </div>
              </div>

              {showApptCalendar && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                  <CalendarPicker selectedDate={customApptDate} onSelect={(d) => { setCustomApptDate(d); setApptDateFilter("Custom"); setShowApptCalendar(false); }} />
                </div>
              )}



               {filteredAppts.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: C.gray500 }}>No appointments found.</p> : (
                 <div style={{ overflowX: "auto", background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, animation: "fadeSlideUp .3s both" }}>
                   <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                     <thead>
                       <tr style={{ background: C.gray50 }}>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Patient / Account</th>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Demographics</th>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Doctor</th>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Reason</th>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Appt Date/Time</th>
                         <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}`, color: C.gray600 }}>Status/Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {filteredAppts.map((a, i) => (
                         <tr key={a._id || a.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                           <td style={s.td}>
                             <div style={{ fontWeight: 800, color: C.gray900 }}>{a.patientName}</div>
                             <div style={{ fontSize: ".76rem", color: C.blue, fontWeight: 700, marginTop: 2 }}>
                               {typeof a.patientId === "object" && a.patientId ? `${a.patientId.firstName} ${a.patientId.lastName}` : "Registered Patient"}
                             </div>
                             <div style={{ fontSize: ".8rem", color: C.blue, fontWeight: 700, marginTop: 4 }}>{a.patientPhone || (typeof a.patientId === "object" ? a.patientId?.phone : "") || "No Phone"}</div>
                           </td>
                           <td style={s.td}>
                             <div style={{ fontSize: ".8rem", color: C.gray700 }}>
                               Age: {a.patientAge || "N/A"} · {a.patientGender || "N/A"}
                               <br/><span style={{ fontSize: ".75rem" }}>Addr: {a.patientAddress || "No address"}</span>
                             </div>
                           </td>
                           <td style={s.td}>
                             <div style={{ fontWeight: 800, color: "#E91E63" }}>{a.doctorName || (typeof a.doctorId === "object" && a.doctorId ? `Dr. ${a.doctorId.firstName} ${a.doctorId.lastName}` : "Doctor")}</div>
                             <div style={{ fontSize: ".78rem", color: C.gray500 }}>ID: {a.doctorId?._id?.slice(-6) || "—"}</div>
                           </td>
                           <td style={s.td}>
                             <div style={{ fontSize: ".8rem", color: C.gray600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }} title={a.reason}>{a.reason || "—"}</div>
                           </td>
                           <td style={s.td}>
                             <div style={{ fontWeight: 700, color: C.gray900 }}>{a.date}</div>
                             <div style={{ fontSize: ".75rem", color: C.blue, fontWeight: 700 }}>{formatSlotRange(formatTime12(a.time), a.slotDuration)}</div>
                             <small style={{ fontSize: ".7rem", color: C.gray400 }}>Booked: {new Date(a.createdAt).toLocaleDateString()}</small>
                           </td>
                           <td style={s.td}>
                             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                               <Bdg size="sm" type={a.status === "completed" || a.status === "approved" ? "green" : "red"}>{a.status}</Bdg>
                               <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                 {a.status === "approved" && isPastOrCurrentSlot(a.date, a.time) && (
                                   <button onClick={() => { if(window.confirm("Mark as completed?")) completeAppt(a._id || a.id); }} style={{ padding: "4px 8px", background: C.green, color: C.white, border: "none", borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: ".7rem" }}>Complete</button>
                                 )}
                                 {(a.status === "approved" && a.date >= getLocalDayStr()) && (
                                   <button onClick={() => setRemindAppt(a)} style={{ padding: "4px 8px", background: C.white, color: C.blue, border: `1px solid ${C.gray200}`, borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: ".7rem" }}>Remind</button>
                                 )}
                                 {a.status === "approved" && a.date >= getLocalDayStr() && (
                                   <button onClick={() => setRejectingApptId(a._id || a.id)} style={{ padding: "4px 8px", background: "none", border: `1px solid ${C.red}`, color: C.red, borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: ".7rem" }}>Reject</button>
                                 )}
                               </div>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          );
        })()}

      {showUnavailPicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 12, width: "100%", maxWidth: 350, overflow: "hidden", animation: "fadeSlideUp .3s", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${C.gray100}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.gray50 }}>
              <strong style={{ fontSize: ".9rem", color: C.gray900 }}>Set Return Date</strong>
              <button onClick={() => setShowUnavailPicker(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: C.red }}>&times;</button>
            </div>
            <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
              <CalendarPicker minDate={getLocalDayStr()} onSelect={(dt) => { setUnavailableDate(showUnavailPicker, dt); setShowUnavailPicker(null); }} />
            </div>
          </div>
        </div>
      )}

      {remindAppt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: C.white, borderRadius: 16, width: 400, padding: 24, animation: "fadeSlideUp .3s" }}>
            <SectionHead title="Send Reminder" />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Btn full color={remindMode === "Email" ? "primary" : "out"} onClick={() => setRemindMode("Email")}>Email</Btn>
              <Btn full color={remindMode === "WhatsApp" ? "primary" : "out"} onClick={() => setRemindMode("WhatsApp")} style={{ background: remindMode === "WhatsApp" ? "#25D366" : "transparent", borderColor: "#25D366", color: remindMode === "WhatsApp" ? C.white : "#25D366" }}>WhatsApp</Btn>
            </div>
            <p style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 16, fontSize: ".9rem", color: C.gray700, fontStyle: "italic", lineHeight: 1.5, marginBottom: 24 }}>
              "Hello {remindAppt.patientName}, this is a reminder for your appointment with {remindAppt.doctorName} on {remindAppt.date} at {formatSlotRange(formatTime12(remindAppt.time), remindAppt.slotDuration)}."
            </p>
            <div style={{ display: "flex", gap: 12 }}>
               <button onClick={() => setRemindAppt(null)} style={{ flex: 1, padding: 12, borderRadius: 8, background: "transparent", border: `1px solid ${C.red}`, color: C.red, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={async () => { 
                const cleanPhone = (remindAppt.patientPhone || "").replace(/\D/g, "");
                const fullTime = formatSlotRange(formatTime12(remindAppt.time), remindAppt.slotDuration);
                const msg = `Hello ${remindAppt.patientName}, this is a reminder for your appointment with ${remindAppt.doctorName} on ${remindAppt.date} at ${fullTime}.`;
                
                if (remindMode === "WhatsApp") {
                  window.open(`https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(msg)}`, "_blank");
                  showMsg(`WhatsApp Reminder Opened`); 
                  setRemindAppt(null); 
                } else if (remindMode === "Email") {
                  try {
                    setToast("Sending Email...");
                    await sendAppointmentReminder(remindAppt._id || remindAppt.id, { msg }, token);
                    showMsg("Email Reminder Sent");
                    setRemindAppt(null);
                  } catch (err) {
                    showMsg(err.response?.data?.error || "Failed to send email");
                  }
                }
              }} style={{ flex: 1, padding: 12, borderRadius: 8, background: C.blue, color: C.white, border: "none", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {rejectingApptId && (() => {
        const appt = appointments.find(a => String(a._id || a.id) === String(rejectingApptId));
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: C.white, borderRadius: 12, width: "100%", maxWidth: 450, overflow: "visible", animation: "fadeSlideUp .3s", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: 16, borderBottom: `1px solid ${C.gray100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1rem", color: C.gray900 }}>Reject & Suggest Reschedule</strong>
                <button onClick={() => { setRejectingApptId(null); setRejectDate(""); setRejectTime(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: C.gray400 }}>&times;</button>
              </div>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: ".9rem", color: C.gray700, marginBottom: 20 }}>
                  You are rejecting <strong>{appt?.patientName}</strong>'s appointment. Please suggest the next available date for this patient:
                </p>

                <div style={{ marginBottom: 24, padding: 16, background: C.blueLt, borderRadius: 12, border: `1px solid ${C.blue}` }}>
                  <label style={{ ...s.lbl, color: C.blue, fontWeight: 800 }}>Next Suggested Date</label>
                  <div style={{ position: "relative", marginTop: 8 }}>
                    <div onClick={() => setShowRejectCalendar(!showRejectCalendar)} style={{ ...s.inp, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: C.white, borderColor: rejectDate ? C.blue : C.gray200 }}>
                      <span style={{ fontWeight: 700, color: rejectDate ? C.blue : C.gray400 }}>
                        {rejectDate ? new Date(rejectDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Select Suggested Date..."}
                      </span>
                      <span>📅</span>
                    </div>
                    {showRejectCalendar && (
                      <div style={{ position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)", zIndex: 100, background: C.white, borderRadius: 12, boxShadow: "0 15px 35px rgba(0,0,0,0.2)", border: `1px solid ${C.gray200}`, padding: 8 }}>
                         <CalendarPicker minDate={getLocalDayStr()} onSelect={(dt) => { setRejectDate(dt); setShowRejectCalendar(false); }} />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => { setRejectingApptId(null); setRejectDate(""); }} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${C.gray200}`, background: "none", color: C.gray500, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}>
                    Cancel
                  </button>
                  <button 
                    disabled={!rejectDate}
                    onClick={() => { 
                      const suggestion = { date: rejectDate };
                      rejectAppt(rejectingApptId, suggestion, token, "clinic"); 
                      setRejectingApptId(null); 
                      setRejectDate(""); 
                      showMsg("Appointment Rejected with Suggestion");
                    }} 
                    style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: !rejectDate ? C.gray200 : C.red, color: C.white, fontWeight: 700, cursor: !rejectDate ? "not-allowed" : "pointer", fontSize: ".85rem" }}
                  >
                    Confirm Reject & Suggest Date
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {tab === "Settings" && (() => {
        if (!settingsLoaded && token) {
          setSettingsLoaded(true);
          getMyProfile("clinic", token).then(p => {
            setCpName(p.name || "");
            setCpPhone(p.phone || "");
            setCpAddress(p.address || "");
            setCpCity(p.city || "");
            setCpState(p.state || "");
            setCpDesc(p.description || "");
            setCpEmail(p.email || "");
            setCpMaxBookingDays(p.maxBookingDays || 7);
          }).catch(() => {});
        }

        const handleUpdateProfile = async () => {
          if (Number(cpMaxBookingDays) < 1) { showMsg("Maximum Booking Days must be at least 1"); return; }
          setCpProfLoading(true);
          try {
            const res = await updateClinicProfile({ name: cpName, phone: cpPhone, address: cpAddress, city: cpCity, state: cpState, description: cpDesc, maxBookingDays: Number(cpMaxBookingDays), email: cpEmail }, token);
            await refreshProfile();
            showMsg(res.message || "Profile updated!");
          } catch (err) { showMsg(err.message || "Update failed"); }
          setCpProfLoading(false);
        };

        const handleChangePass = async () => {
          if (!chCurrent || !chNew) { showMsg("Fill all password fields"); return; }
          if (chNew.length < 8) { showMsg("New password must be at least 8 characters"); return; }
          if (chNew !== chConfirm) { showMsg("New passwords do not match"); return; }
          setChLoading(true);
          try {
            const res = await changePassword(chCurrent, chNew, token);
            showMsg(res.message || "Password changed!");
            setChCurrent(""); setChNew(""); setChConfirm("");
          } catch (err) { showMsg(err.message || "Failed to change password"); }
          setChLoading(false);
        };

        return (
          <div style={{ animation: "fadeSlideUp .3s both", maxWidth: 650, margin: "0 auto", padding: R.isMobile ? "20px 16px" : "32px 20px" }}>
            <SectionHead title="Clinic Settings" sub="Update your clinic profile and password" />

            {/* Clinic Profile */}
            <form onSubmit={e => { e.preventDefault(); handleUpdateProfile(); }} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: R.isMobile ? 20 : 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: C.gray900, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                Update Clinic Profile
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label style={s.lbl}>Email</label>
                <input type="email" style={s.inp} value={cpEmail} onChange={e => setCpEmail(e.target.value)} placeholder="Email Address" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={s.lbl}>Clinic Name</label>
                  <input style={s.inp} value={cpName} onChange={e => setCpName(e.target.value)} placeholder="Clinic Name" />
                </div>
                <div>
                  <label style={s.lbl}>Phone (10 digits)</label>
                  <input type="tel" maxLength="10" style={s.inp} value={cpPhone} onChange={e => setCpPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit phone" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.lbl}>Address</label>
                <input style={s.inp} value={cpAddress} onChange={e => setCpAddress(e.target.value)} placeholder="Full Address" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={s.lbl}>City</label>
                  <input style={s.inp} value={cpCity} onChange={e => setCpCity(e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label style={s.lbl}>State</label>
                  <input style={s.inp} value={cpState} onChange={e => setCpState(e.target.value)} placeholder="State" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.lbl}>Maximum Booking Days (Advance)</label>
                <input type="number" min="1" style={s.inp} value={cpMaxBookingDays} onChange={e => setCpMaxBookingDays(e.target.value)} placeholder="e.g. 7" />
                <p style={{ fontSize: ".7rem", color: C.gray400, marginTop: 4 }}>How many days in advance patients can book appointments.</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.lbl}>Description</label>
                <textarea style={{ ...s.inp, height: 80, padding: 12 }} value={cpDesc} onChange={e => setCpDesc(e.target.value)} placeholder="Short description of clinic" />
              </div>
              <Btn type="submit" full disabled={cpProfLoading}>
                {cpProfLoading ? "Saving..." : "Save Clinic Profile"}
              </Btn>
            </form>

            {/* Change Password */}
            <form onSubmit={e => { e.preventDefault(); handleChangePass(); }} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: R.isMobile ? 20 : 28 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: C.gray900, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                Change Password
              </h3>
              <div style={{ marginBottom: 14 }}>
                <Inp label="Current Password" type="password" value={chCurrent} onChange={e => setChCurrent(e.target.value)} placeholder="Your current password" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <Inp label="New Password" type="password" value={chNew} onChange={e => setChNew(e.target.value)} placeholder="Min. 8 characters" />
                </div>
                <div>
                  <Inp label="Confirm New Password" type="password" value={chConfirm} onChange={e => setChConfirm(e.target.value)} placeholder="Repeat new password" />
                </div>
              </div>
              <Btn type="submit" full color="amber" disabled={chLoading}>
                {chLoading ? "Changing..." : "Change Password"}
              </Btn>
            </form>
          </div>
        );
      })()}
      </div>
      <SupportFAB onClick={() => setSupportModalOpen(true)} />
      <SupportModal 
        isOpen={supportModalOpen} 
        onClose={() => setSupportModalOpen(false)} 
        token={token}
      />
    </div>
  );
}
