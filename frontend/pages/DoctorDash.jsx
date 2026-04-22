import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useAppointment } from "../context/AppointmentContext";
import C from "../constants/colors";
import s from "../constants/styles";
import { Btn, Bdg, Inp } from "../components/shared/UI";
import CalendarPicker from "../components/shared/CalendarPicker";
import useResponsive from "../hooks/useResponsive";
import { loadAppts } from "../utils/appointmentHelpers";
import { 
  rejectAppointment, 
  completeAppointment, 
  changePassword,
  getMyProfile 
} from "../services/api";
import { formatTime12, formatSlotRange } from "../utils/timeUtils";
import { useSearchParams, useNavigate } from "react-router-dom";


// --- Components ---
const StatCard = ({ label, value }) => {
  const R = useResponsive();
  return (
    <div style={{ 
      background: C.white, 
      padding: R.width < 350 ? "12px 10px" : "16px 20px", 
      borderRadius: 12, 
      border: `1px solid ${C.gray200}`, 
      minWidth: R.width < 350 ? 0 : 120,
      textAlign: "center"
    }}>
      <div style={{ fontSize: R.width < 350 ? ".65rem" : ".75rem", fontWeight: 700, color: C.gray500, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: R.width < 350 ? "1.1rem" : "1.4rem", fontWeight: 900, color: C.gray900 }}>{value}</div>
    </div>
  );
};

const AnimCard = ({ children, style, delay = 0 }) => (
  <div style={{ 
    background: C.white, 
    borderRadius: 16, 
    padding: 24, 
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)", 
    border: `1px solid ${C.gray200}`,
    animation: `fadeSlideUp .4s both ${delay}s`,
    ...style
  }}>
    {children}
  </div>
);

const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: 24, animation: "fadeSlideUp .3s both" }}>
    <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: C.gray900 }}>{title}</h2>
    {sub && <p style={{ color: C.gray500, fontSize: ".86rem", marginTop: 4 }}>{sub}</p>}
  </div>
);

const InfoCard = ({ title, children, style }) => (
  <div style={{ 
    background: C.white, 
    borderRadius: 12, 
    border: `1px solid ${C.gray200}`, 
    padding: "24px", 
    flex: 1, 
    width: "100%",
    boxSizing: "border-box",
    ...style 
  }}>
    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: C.gray900, marginBottom: 20 }}>{title}</h3>
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {children}
    </div>
  </div>
);

const InfoItem = ({ label, value, color, justify }) => (
  <div>
    <div style={{ fontSize: ".72rem", fontWeight: 800, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: ".95rem", fontWeight: 700, color: color || C.gray800, textAlign: justify ? "justify" : "left" }}>{value || "—"}</div>
  </div>
);

const ShiftItem = ({ label, start, end, active }) => (
  <div style={{ flex: 1, minWidth: 140 }}>
    <div style={{ fontSize: ".72rem", fontWeight: 800, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label} Shift</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? C.green : C.gray300 }} />
      <div style={{ fontSize: ".9rem", fontWeight: 700, color: active ? C.gray800 : C.gray400 }}>
        {active ? `${start} - ${end}` : "Inactive"}
      </div>
    </div>
  </div>
);

export default function DoctorDash({ theme }) {
  const { session, token, logout, showToast } = useAuth();
  const { appointments, setAppts, initSocketListeners } = useAppointment();
  const R = useResponsive();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  if (session?.role && session.role !== "doctor") {
    setTimeout(() => {
      if (session.role === "patient") navigate("/patient/dashboard");
      else if (session.role === "clinic") navigate("/clinic/dashboard");
      else if (session.role === "admin") navigate("/admin/dashboard");
    }, 0);
    return null;
  }

  const [tab, setInternalTab] = useState(() => searchParams.get("tab") || "Appointments");

  useEffect(() => {
    const pTab = searchParams.get("tab") || "Appointments";
    if (pTab !== tab) setInternalTab(pTab);
  }, [searchParams]);

  const setTab = (t) => {
    setInternalTab(t);
    setSearchParams({ tab: t });
  };

  const [prof, setProf] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("Today");
  const [customDate, setCustomDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Change Password state
  const [chCurrent, setChCurrent] = useState("");
  const [chNew, setChNew] = useState("");
  const [chConfirm, setChConfirm] = useState("");
  const [chLoading, setChLoading] = useState(false);

  const getLocalDayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const refreshData = useCallback(async () => {
    if (token) {
      loadAppts("doctor", token, setAppts).catch(() => {});
      try {
        const p = await getMyProfile("doctor", token);
        setProf(p);
      } catch (e) {
        if (showToast) showToast("Failed to load profile data.", true);
      }
    }
  }, [token, setAppts, showToast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (token && session._id) {
      const cleanup = initSocketListeners("doctor", session._id, token);
      return cleanup;
    }
  }, [token, session._id, initSocketListeners]);

  const handleComplete = async (id) => {
    try {
      if (!window.confirm("Mark this appointment as completed?")) return;
      await completeAppointment(id, token);
      refreshData();
      showToast("Appointment completed!");
    } catch (err) { showToast(err.message, true); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (chNew !== chConfirm) return showToast("New passwords do not match!", true);
    if (chNew.length < 8) return showToast("Password must be at least 8 characters.", true);

    setChLoading(true);
    try {
      await changePassword(chCurrent, chNew, token);
      showToast("Password updated successfully!");
      setChCurrent(""); setChNew(""); setChConfirm("");
    } catch (err) { showToast(err.message, true); }
    setChLoading(false);
  };

  const stats = {
    today: appointments.filter(a => a.date === getLocalDayStr()).length,
    total: appointments.length,
    earnings: appointments.filter(a => a.status === "completed" && !a.settled).reduce((sum, a) => sum + (a.clinic_earning || 0), 0)
  };

  const filteredAppts = appointments.filter(a => {
    const patName = (a.patientName || "").toLowerCase();
    if (search && !patName.includes(search.toLowerCase())) return false;

    const getRelativeDate = (offset) => {
      const d = new Date(); d.setDate(d.getDate() + offset);
      return getLocalDayStr(d);
    };

    // "All" shows everything including cancelled
    if (dateFilter === "All") return true;
    if (dateFilter === "Today") return a.date === getLocalDayStr();
    if (dateFilter === "Yesterday") return a.date === getRelativeDate(-1);
    if (dateFilter === "Tomorrow") return a.date === getRelativeDate(1);
    if (dateFilter === "Custom" && customDate) return a.date === customDate;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.gray50, color: C.gray900 }}>
      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: R.isMobile ? "24px 16px" : "32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {prof?.photoUrl && (
              <img 
                src={prof.photoUrl} 
                alt="Profile" 
                style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.blueLt}` }} 
              />
            )}
            <div>
              <h1 style={{ fontSize: R.isMobile ? "1.4rem" : "1.8rem", fontWeight: 800, color: C.gray900, marginBottom: 6 }}>{session.name}</h1>
              <p style={{ color: C.gray500, fontSize: ".9rem" }}>{prof?.specialty || "Doctor"} Dashboard · Manage your practice</p>
            </div>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: R.isMobile ? "1fr" : "repeat(3, 1fr)", 
            gap: 12, 
            flexGrow: R.isMobile ? 1 : 0,
            width: "100%"
          }}>
            <StatCard label="Today" value={stats.today} />
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Earnings" value={`₹${stats.earnings}`} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: R.isMobile ? "20px 16px" : "32px 20px" }}>
        {/* Tabs */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: R.width < 480 ? "1fr" : "repeat(3, 1fr)", 
          background: C.gray100, 
          borderRadius: 8, 
          padding: 4, 
          gap: 4, 
          marginBottom: 32 
        }}>
          {["Appointments", "Profile", "Settings"].map(t => (
            <button 
              key={t} 
              onClick={() => setTab(t)} 
              style={{ 
                padding: "12px", border: "none", fontWeight: 700, 
                fontSize: R.width < 350 ? ".75rem" : ".85rem", cursor: "pointer", 
                borderRadius: 6, background: tab === t ? C.blue : "transparent", 
                color: tab === t ? C.white : C.gray500,
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

        {tab === "Profile" && prof && (
          <div style={{ animation: "fadeSlideUp .3s both", display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Top Identity Card */}
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, padding: R.isMobile ? "20px 16px" : "24px 32px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <img src={prof.photoUrl || "https://via.placeholder.com/150"} alt="Doc" style={{ width: 100, height: 100, borderRadius: 16, objectFit: "cover", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: C.gray900, marginBottom: 4 }}>Dr. {prof.firstName} {prof.lastName}</h1>
                <p style={{ color: C.gray500, fontSize: "1rem", fontWeight: 600 }}>{prof.specialty} {prof.expertise ? `(${prof.expertise})` : ""} · {prof.degree}</p>
              </div>
            </div>

            {/* Middle Row: Info & Contact */}
            <div style={{ display: "flex", flexDirection: R.width < 900 ? "column" : "row", gap: 24, flexWrap: "wrap" }}>
              <InfoCard title="Professional Info">
                <InfoItem label="Specialty" value={prof.specialty} />
                <InfoItem label="Expertise" value={prof.expertise} />
                <InfoItem label="Reg No" value={prof.regNo} />
                <InfoItem label="College" value={prof.college} />
                <InfoItem label="Experience" value={`${prof.exp} years`} />
                <InfoItem label="Consultation Fee" value={`Rs.${prof.fee}`} />
                <InfoItem label="Gender" value={prof.gender} />
              </InfoCard>

              <InfoCard title="Contact & Bio">
                <InfoItem label="Email" value={prof.email} />
                <InfoItem label="Phone" value={prof.phone} />
                <InfoItem label="Bio" value={prof.bio} justify />
              </InfoCard>
            </div>

            {/* Bottom Card: Availability */}
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, padding: "32px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: C.gray900, marginBottom: 28 }}>Availability & Scheduling</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "repeat(2, 1fr)", gap: "40px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <InfoItem label="Slot Duration" value={`${prof.slotDuration} Mins`} />
                  <InfoItem label="Booking Cutoff" value={prof.bookingCutoffDay === "same_day" ? "Same Day (None)" : `Tomorrow at ${prof.tomorrowBookingCutoffTime}`} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap: "24px" }}>
                  <ShiftItem label="Morning" start={prof.morningStartTime} end={prof.morningEndTime} active={prof.morningActive} />
                  <ShiftItem label="Afternoon" start={prof.afternoonStartTime} end={prof.afternoonEndTime} active={prof.afternoonActive} />
                  <ShiftItem label="Evening" start={prof.eveningStartTime} end={prof.eveningEndTime} active={prof.eveningActive} />
                  <ShiftItem label="Night" start={prof.nightStartTime} end={prof.nightEndTime} active={prof.nightActive} />
                </div>
              </div>
            </div>

            {/* Clinical Association Footer */}
            <div style={{ background: C.gray100, padding: 20, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.gray200}` }}>
              <div>
                <div style={{ fontSize: ".7rem", fontWeight: 800, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Registered Workplace</div>
                <div style={{ fontWeight: 700, color: C.gray900 }}>{prof.clinicId?.name}</div>
                <div style={{ fontSize: ".85rem", color: C.gray500 }}>{prof.clinicId?.city}, {prof.clinicId?.address}</div>
              </div>
              <Bdg blue sm>Active Association</Bdg>
            </div>
          </div>
        )}

        {tab === "Appointments" && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            {/* Search & Filters */}
            <div style={{ background: C.white, padding: 16, borderRadius: 12, border: `1px solid ${C.gray200}`, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                style={{ ...s.inp, marginBottom: 0, flex: 1, minWidth: 200 }} 
                placeholder="Search patient..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Today", "Yesterday", "Tomorrow", "All"].map(f => (
                  <button 
                    key={f} 
                    onClick={() => { setDateFilter(f); setShowCalendar(false); }} 
                    style={{ 
                      padding: "8px 14px", borderRadius: 8, border: "none", 
                      background: dateFilter === f ? C.blue : C.gray100, 
                      color: dateFilter === f ? C.white : C.gray700, 
                      fontWeight: 700, cursor: "pointer", fontSize: ".85rem" 
                    }}
                  >
                    {f}
                  </button>
                ))}
                <button 
                  onClick={() => setShowCalendar(!showCalendar)}
                  style={{ 
                    padding: "8px 14px", borderRadius: 8, border: "none", 
                    background: dateFilter === "Custom" ? C.blue : C.gray100, 
                    color: dateFilter === "Custom" ? C.white : C.gray700, 
                    fontWeight: 700, cursor: "pointer", fontSize: ".85rem" 
                  }}
                >
                  Calendar
                </button>
              </div>
            </div>

            {showCalendar && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <CalendarPicker 
                  selectedDate={customDate} 
                  onSelect={(dt) => { setCustomDate(dt); setDateFilter("Custom"); setShowCalendar(false); }} 
                />
              </div>
            )}

            {/* List */}
            <div style={{ overflowX: "auto", background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ background: C.gray50 }}>
                    <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}` }}>PATIENT / ACCOUNT</th>
                    <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}` }}>DEMOGRAPHICS</th>
                    <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}` }}>REASON</th>
                    <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}` }}>APPT DATE/TIME</th>
                    <th style={{ ...s.th, borderBottom: `1px solid ${C.gray200}` }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppts.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 40, textAlign: "center", color: C.gray400 }}>No appointments found.</td></tr>
                  ) : (
                    filteredAppts.map(a => (
                      <tr key={a._id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                        <td style={s.td}>
                          <div style={{ fontWeight: 800, color: C.gray900, fontSize: "1rem" }}>{a.patientName}</div>
                          <div style={{ fontSize: ".75rem", color: C.blue, fontWeight: 700, marginTop: 2 }}>{a.patientEmail}</div>
                          <div style={{ fontSize: ".75rem", color: C.gray500, marginTop: 2 }}>{a.patientPhone}</div>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".85rem", color: C.gray700 }}>Age: {a.patientAge} · {a.patientGender}</div>
                          <div style={{ fontSize: ".75rem", color: C.gray500, marginTop: 4, maxWidth: 200 }}>Addr: {a.patientAddress}</div>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".85rem", color: C.gray700, fontWeight: 600, textTransform: "uppercase" }}>{a.reason || "General Consultation"}</div>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontWeight: 800, color: C.gray900 }}>{a.date}</div>
                          <div style={{ fontWeight: 800, color: C.blue, fontSize: ".85rem", marginTop: 2 }}>
                            {a.timeSlot || formatSlotRange(formatTime12(a.time), a.slotDuration)}
                          </div>
                          <div style={{ marginTop: 6 }}><Bdg status={a.status} /></div>
                        </td>
                        <td style={s.td}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {a.status === "approved" && (
                              <button onClick={() => handleComplete(a._id)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: C.blue, color: C.white, fontWeight: 700, cursor: "pointer", fontSize: ".75rem" }}>Mark Completed</button>
                            )}
                            {(a.status === "completed" || a.status === "cancelled") && (
                              <span style={{ fontSize: ".75rem", color: C.gray400, fontStyle: "italic" }}>No actions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Settings" && (
          <div style={{ maxWidth: 500, margin: "0 auto", animation: "fadeSlideUp .3s both" }}>
            <AnimCard>
              <SectionHead title="Security" sub="Change your dashboard password" />
              <form onSubmit={handleChangePassword}>
                <Inp label="Current Password" type="password" value={chCurrent} onChange={e => setChCurrent(e.target.value)} required />
                <Inp label="New Password" type="password" value={chNew} onChange={e => setChNew(e.target.value)} required />
                <Inp label="Confirm New Password" type="password" value={chConfirm} onChange={e => setChConfirm(e.target.value)} required />
                <Btn type="submit" full disabled={chLoading}>{chLoading ? "Updating..." : "Update Password"}</Btn>
              </form>
            </AnimCard>
          </div>
        )}
      </div>
    </div>
  );
}
