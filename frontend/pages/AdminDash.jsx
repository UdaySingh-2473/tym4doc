import { useState, useEffect, useMemo } from "react";
import s from "../constants/styles";
import C from "../constants/colors";
import useResponsive from "../hooks/useResponsive";
import { useAuth } from "../context/AuthContext";
import { useClinic } from "../context/ClinicContext";
import { useAppointment } from "../context/AppointmentContext";
import { TabBtns, Btn, Bdg, Inp } from "../components/shared/UI";
import { 
  getCommissionStats, getAllAppointments, addSpecialty, getSpecialties,
  getAdminPatients, getAdminClinicStats, getAdminPatientHistory, getAdminDoctorHistory,
  getAllDoctorsAdmin
} from "../services/api";
import { getSocket, joinRoom, leaveRoom } from "../services/socket";
import { useSearchParams, useNavigate } from "react-router-dom";
import { formatSlotRange } from "../utils/timeUtils";

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

function DetailRow({ label, value }) {
  return (
    <div>
      <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>{label}</small>
      <div style={{ fontSize: ".9rem", fontWeight: 700, color: C.gray900, marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
}

export default function AdminDash() {
  const R = useResponsive();
  const formatTime12 = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    let hh = parseInt(h);
    const mmm = m || "00";
    const mer = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    return `${hh}:${mmm} ${mer}`;
  };

  const { token, session } = useAuth();
  const { clinics, pendingClinics, admApprove, admReject, admBlock, admSettle, refreshClinics, setClinics } = useClinic();
  const { appointments } = useAppointment();

  const navigate = useNavigate();

  // Guard: If authenticated but role isn't admin, redirect away
  if (session?.role && session.role !== "admin") {
    setTimeout(() => {
      if (session.role === "patient") navigate("/patient/dashboard");
      else if (session.role === "clinic") navigate("/clinic/dashboard");
    }, 0);
    return null;
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setInternalTab] = useState(() => searchParams.get("tab") || "Pending Clinics");
  const [view, setInternalView] = useState(() => searchParams.get("view") || "list");

  const [searchQuery, setSearchQuery] = useState("");
  const [commStats, setCommStats] = useState({ totalAppointments:0, totalCommission:0 });
  const [patients, setPatients] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(() => {
    try { const s = sessionStorage.getItem("adminSelPat"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  useEffect(() => {
    if (selectedPatient) sessionStorage.setItem("adminSelPat", JSON.stringify(selectedPatient));
    else sessionStorage.removeItem("adminSelPat");
  }, [selectedPatient]);

  const [selectedClinic, setSelectedClinic] = useState(() => {
    try { const s = sessionStorage.getItem("adminSelCli"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  useEffect(() => {
    if (selectedClinic) sessionStorage.setItem("adminSelCli", JSON.stringify(selectedClinic));
    else sessionStorage.removeItem("adminSelCli");
  }, [selectedClinic]);

  const [selectedDoctor, setSelectedDoctor] = useState(() => {
    try { const s = sessionStorage.getItem("adminSelDoc"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  useEffect(() => {
    if (selectedDoctor) sessionStorage.setItem("adminSelDoc", JSON.stringify(selectedDoctor));
    else sessionStorage.removeItem("adminSelDoc");
  }, [selectedDoctor]);

  const [drilldownLoading, setDrilldownLoading] = useState(() => {
    const v = searchParams.get("view");
    return v && v.endsWith("Detail"); 
  });

  // Sync with browser history
  useEffect(() => {
    const pTab = searchParams.get("tab") || "Pending Clinics";
    const pView = searchParams.get("view") || "list";
    if (pTab !== tab) setInternalTab(pTab);
    if (pView !== view) setInternalView(pView);
  }, [searchParams]);

  const setTab = (t) => {
    setInternalTab(t);
    setSearchQuery("");
    setSearchParams({ tab: t, view: "list" });
  };

  const setView = (v, params = {}) => {
    setInternalView(v);
    
    // Convert any nested objects or keep it simple. Usually query params are flat strings.
    // For AdminDash, params were just { cId: 123 }, etc., but we don't strictly require 
    // them to be in the URL since Admin doesn't do deep reloads of drilldowns yet 
    // (requires fetching on mount).
    // For now we persist tab and view:
    const newParams = { tab, view: v };
    if (params.pId) newParams.pId = params.pId;
    if (params.cId) newParams.cId = params.cId;
    if (params.dId) newParams.dId = params.dId;
    
    setSearchParams(newParams);
  };

  const handlePatientClick = async (patient) => {
    setDrilldownLoading(true);
    try {
      const history = await getAdminPatientHistory(patient._id, token);
      setSelectedPatient({ ...patient, history });
      setView("patientDetail", { pId: patient._id });
    } catch { alert("Error fetching patient history"); }
    setDrilldownLoading(false);
  };

  const handleClinicClick = async (clinic) => {
    setDrilldownLoading(true);
    try {
      const stats = await getAdminClinicStats(clinic._id, token);
      setSelectedClinic(stats);
      setSearchQuery(""); // Clear search when entering detail
      setView("clinicDetail", { cId: clinic._id });
    } catch { alert("Error fetching clinic stats"); }
    setDrilldownLoading(false);
  };

  const handleSettleClick = async (id) => {
    // admSettle has its own confirmation inside ClinicContext
    await admSettle(id, token);
    // After settlement, refresh everything to avoid blank pages and stale stats
    getCommissionStats(token).then(setCommStats).catch(() => {});
    if (view === "clinicDetail" && selectedClinic?.clinic?._id === id) {
      setDrilldownLoading(true);
      getAdminClinicStats(id, token).then(setSelectedClinic).catch(() => {}).finally(() => setDrilldownLoading(false));
    }
  };

  const handleDoctorClick = async (doctor) => {
    setDrilldownLoading(true);
    try {
      const history = await getAdminDoctorHistory(doctor._id, token);
      setSelectedDoctor({ ...doctor, history });
      setView("doctorDetail", { dId: doctor._id });
    } catch { alert("Error fetching doctor history"); }
    setDrilldownLoading(false);
  };

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || 
      p.email.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  const filteredClinics = useMemo(() => {
    if (!searchQuery) return clinics;
    const q = searchQuery.toLowerCase();
    return clinics.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.city?.toLowerCase().includes(q) || 
      c.state?.toLowerCase().includes(q) || 
      c.email?.toLowerCase().includes(q) || 
      c.phone?.includes(q)
    );
  }, [clinics, searchQuery]);

  const filteredDoctors = useMemo(() => {
    if (!searchQuery) return allDoctors;
    const q = searchQuery.toLowerCase();
    return allDoctors.filter(d => 
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) || 
      (d.phone || "").toLowerCase().includes(q) ||
      d.degree?.toLowerCase().includes(q) ||
      d.specialty?.toLowerCase().includes(q) ||
      d.clinicId?.name?.toLowerCase().includes(q)
    );
  }, [allDoctors, searchQuery]);

  useEffect(() => {
    if (token) {
      getCommissionStats(token).then(setCommStats).catch(() => {});
      getAdminPatients(token).then(res => {
        setPatients(res);
        // On mount, if we have a pId but no selectedPatient, try to find it
        const pId = searchParams.get("pId");
        if (pId && !selectedPatient && view === "patientDetail") {
          const found = res.find(p => p._id === pId);
          if (found) handlePatientClick(found);
        }
      }).catch(() => {});
      
      if (tab === "Doctors" && allDoctors.length === 0) {
        setDoctorsLoading(true);
        getAllDoctorsAdmin(token).then(res => {
          setAllDoctors(res);
          // Restore doctor if dId is present
          const dId = searchParams.get("dId");
          if (dId && !selectedDoctor && view === "doctorDetail") {
            const found = res.find(d => d._id === dId);
            if (found) handleDoctorClick(found);
          }
        }).catch(() => {}).finally(() => setDoctorsLoading(false));
      }

      // Restore clinic if cId is present
      const cId = searchParams.get("cId");
      if (cId && !selectedClinic && view === "clinicDetail") {
         // Logic to refetch clinic stats directly if we just reloaded
         getAdminClinicStats(cId, token).then(setSelectedClinic).catch(() => {});
      }

      // Real-time admin tracking
      joinRoom("admin");
      const socket = getSocket();
      
      const handleAdminActivity = () => {
        // Refresh global state when there is activity
        getCommissionStats(token).then(setCommStats).catch(() => {});
        getAdminPatients(token).then(setPatients).catch(() => {});
        refreshClinics(token); 
      };
      
      socket.on("admin-activity", handleAdminActivity);
      
      return () => {
        socket.off("admin-activity", handleAdminActivity);
        leaveRoom("admin");
      }
    }
  }, [token, setClinics]);


  const totalAppts = appointments.length;
  const totalClinics = clinics.length;
  const totalPending = pendingClinics.length;

  return (
    <div style={{ minHeight: "100vh", background: C.gray50, color: C.gray900 }}>
      {/* HEADER */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: R.isMobile ? "24px 16px" : "32px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: R.isMobile ? "1.4rem" : "1.8rem", fontWeight: 800, color: C.gray900, marginBottom: 6 }}>
              Admin Dashboard
            </h1>
            <p style={{ color: C.gray500, fontSize: ".9rem" }}>Manage clinics, appointments and platform revenue</p>
          </div>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: R.width < 380 ? "1fr" : R.width < 900 ? "repeat(2, 1fr)" : "repeat(4, 1fr)", 
            gap: 12, 
            flexGrow: R.isMobile ? 1 : 0,
            width: R.width < 900 ? "100%" : "auto"
          }}>
            <StatCard label="Clinics" value={totalClinics} />
            <StatCard label="Patients" value={commStats.totalPatients || 0} />
            <StatCard label="Pending" value={totalPending} />
            <StatCard label="Revenue" value={`Rs.${commStats.totalCommission?.toFixed(0) || 0}`} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: R.isMobile ? "20px 16px" : "32px 20px" }}>
        
        {view === "list" && (
          <>
            {/* TABS */}
            <div style={{ display: "flex", background: C.gray100, borderRadius: 8, padding: 4, gap: 4, marginBottom: 32, flexWrap: "wrap" }}>
              {["Pending Clinics", "All Clinics", "Patients", "Appointments"].map(t => (
                <button
                  key={t} onClick={() => setTab(t)}
                  style={{
                    flex: R.width < 450 ? "0 0 calc(50% - 4px)" : 1, 
                    padding: R.width < 400 ? "10px 8px" : "12px 16px", 
                    border: "none", fontFamily: "inherit", fontWeight: 700,
                    fontSize: R.width < 400 ? ".75rem" : ".85rem", cursor: "pointer", borderRadius: 6,
                    background: tab === t ? C.blue : "transparent",
                    color: tab === t ? C.white : C.gray500, transition: "all .2s ease", 
                    minWidth: R.width < 450 ? 0 : 100,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {(tab === "All Clinics" || tab === "Patients") && (
              <div style={{ marginBottom: 24 }}>
                <Inp 
                  placeholder={tab === "Patients" ? "Search patients by name or email..." : "Search clinics by name, city, state, email or phone..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}

            {tab === "Pending Clinics" && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <SectionHead title="Pending Verifications" sub="Review and approve/reject clinic registration requests" />
                {pendingClinics.length === 0 ? (
                  <p style={{ color:C.gray500, textAlign:"center", padding:40, background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>No pending clinic registrations.</p>
                ) : (
                  pendingClinics.map((c, i) => (
                    <AnimCard key={c._id} delay={i * 0.04} style={{ marginBottom: 16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontWeight:800, fontSize:"1.05rem", color:C.gray900 }}>{c.name}</h4>
                          <div style={{ fontSize:".85rem", color:C.gray500, marginTop:10, lineHeight: 1.6 }}>
                            <p>Email: {c.email}</p>
                            <p>Address: {c.address}, {c.city}, {c.state}</p>
                            {c.phone && <p>Phone: {c.phone}</p>}
                          </div>
                          {c.description && <p style={{ fontSize:".85rem", color:C.gray700, marginTop:12, padding: "12px", background: C.gray50, borderRadius: 6, border: `1px solid ${C.gray200}` }}>{c.description}</p>}
                          {c.documents && (
                            <div style={{ marginTop: 14 }}>
                              <a href={c.documents} target="_blank" rel="noopener noreferrer" style={{ fontSize:".85rem", color:C.blue, fontWeight:700 }}>View Documents</a>
                            </div>
                          )}
                          <div style={{ marginTop:16 }}>
                            <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: 4, fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" }}>Pending Verification</span>
                            <span style={{ fontSize:".75rem", color:C.gray400, marginLeft:12 }}>Registered: {new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:10, alignItems: "center" }}>
                          <Btn onClick={() => admApprove(c._id, token)}>Approve</Btn>
                          <Btn variant="out" color="red" onClick={() => admReject(c._id, token)}>Reject</Btn>
                        </div>
                      </div>
                    </AnimCard>
                  ))
                )}
              </div>
            )}

            {tab === "All Clinics" && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <SectionHead title="All Clinics" sub="Manage approved/blocked clinics and view revenue" />
                {filteredClinics.length === 0 ? (
                  <p style={{ color:C.gray500, textAlign:"center", padding:40, background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>No clinics found.</p>
                ) : (
                  <div style={{ overflowX:"auto", background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Clinic</th>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>City</th>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Clinic Rev</th>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Admin Rev</th>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Status</th>
                          <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClinics.map(c => (
                          <tr key={c._id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                            <td style={{ ...s.td, padding: "16px 12px", cursor: "pointer" }} onClick={() => handleClinicClick(c)}>
                              <strong style={{ color: C.blue }}>{c.name}</strong>
                              <br /><span style={{ fontSize:".75rem", color:C.gray500 }}>{c.email}</span>
                            </td>
                            <td style={{ ...s.td, padding: "16px 12px", color: C.gray700 }}>{c.city}, {c.state}</td>
                            <td style={{ ...s.td, padding: "16px 12px", color: C.green, fontWeight: 700 }}>Rs.{c.totalRevenue || 0}</td>
                            <td style={{ ...s.td, padding: "16px 12px", color: C.blue, fontWeight: 700 }}>Rs.{c.adminRevenue || 0}</td>
                            <td style={{ ...s.td, padding: "16px 12px" }}>
                              <span style={{
                                background: c.status === "approved" ? "#dcfce7" : c.status === "blocked" ? "#fee2e2" : "#fef3c7",
                                color: c.status === "approved" ? "#166534" : c.status === "blocked" ? "#991b1b" : "#92400e",
                                padding: "4px 8px", borderRadius: 4, fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase"
                              }}>{c.status}</span>
                            </td>
                            <td style={{ ...s.td, padding: "16px 12px" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <Btn size="sm" variant="out" onClick={() => handleClinicClick(c)}>Details</Btn>
                                {c.status === "approved" && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleSettleClick(c._id); }} style={{ background: C.green, border: "none", color: C.white, padding: "6px 12px", borderRadius: 6, fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>Settle</button>
                                    <button onClick={(e) => { e.stopPropagation(); admBlock(c._id, token); }} style={{ background: C.white, border: `1px solid #fecaca`, color: C.red, padding: "6px 12px", borderRadius: 6, fontSize: ".75rem", fontWeight: 600, cursor: "pointer" }}>Block</button>
                                  </>
                                )}
                                {c.status === "blocked" && <button onClick={(e) => { e.stopPropagation(); admApprove(c._id, token); }} style={{ background: C.white, border: `1px solid ${C.gray300}`, color: C.gray700, padding: "6px 12px", borderRadius: 6, fontSize: ".75rem", fontWeight: 600, cursor: "pointer" }}>Unblock</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "Patients" && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <SectionHead title="Registered Patients" sub="View patient profiles and appointment history" />
                {filteredPatients.length === 0 ? (
                  <p style={{ color:C.gray500, textAlign:"center", padding:40, background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>No patients found.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {filteredPatients.map((p, i) => (
                      <AnimCard key={p._id} delay={i * 0.02} hoverable onClick={() => handlePatientClick(p)}>
                        <h4 style={{ fontWeight: 800, color: C.gray900 }}>{p.firstName} {p.lastName}</h4>
                        <p style={{ color: C.gray500, fontSize: ".85rem", marginTop: 4 }}>{p.email}</p>
                        <div style={{ marginTop: 12, fontSize: ".8rem", color: C.blue, fontWeight: 700 }}>View Appointments &rarr;</div>
                      </AnimCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "Appointments" && (
              <div style={{ animation: "fadeSlideUp .3s both" }}>
                <SectionHead title="All Appointments" sub="Platform-wide appointment overview with commission breakdown" />
                <div style={{ overflowX:"auto", background: C.white, borderRadius: 8, border: `1px solid ${C.gray200}` }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Patient / Account</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Demographics</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Doctor/Clinic</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Reason</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Appt Date/Time</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Booked At</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Payment</th>
                        <th style={{ ...s.th, background: C.gray50, borderBottom: `1px solid ${C.gray200}`, color: C.gray700 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.slice(0, 100).map(a => (
                        <tr key={a._id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                          <td style={s.td}>
                            <div style={{fontWeight: 800, color: C.gray900}}>{a.patientName}</div>
                            {a.patientPhone && <div style={{fontSize: ".75rem", color: C.blue, fontWeight: 700}}>{a.patientPhone}</div>}
                            {a.patientId && (
                                <div style={{fontSize: ".75rem", color: C.blue, marginTop: 4, fontWeight: 700}}>
                                    {a.patientId.firstName} {a.patientId.lastName}
                                </div>
                            )}
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".78rem", color: C.gray700}}>
                              Age: {a.patientAge || "N/A"} · {a.patientGender || "N/A"}
                              <br/>{a.patientAddress || "No address"}
                            </div>
                          </td>
                          <td style={s.td}>
                            <strong>{a.doctorName}</strong>
                            <br/><small style={{color: C.gray500}}>{a.clinicId?.name || "—"}</small>
                          </td>
                          <td style={s.td}>
                            <p style={{fontSize: ".8rem", color: C.gray600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} title={a.reason}>{a.reason || "—"}</p>
                          </td>
                          <td style={s.td}>
                             {a.date}
                             <br/><small style={{color: C.blue, fontWeight: 700}}>{formatSlotRange(formatTime12(a.time), a.slotDuration)}</small>
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".8rem", color: C.gray800}}>
                                {new Date(a.createdAt).toLocaleDateString()}
                                <br/><small style={{color: C.gray400}}>{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".8rem", fontWeight: 700, color: C.green}}>Rs.{a.total_fee}</div>
                            <small style={{fontSize: ".65rem", color: C.gray400}}>{a.payment?.status?.toUpperCase() || "PENDING"}</small>
                            {a.payment?.paidAt && (
                                <div style={{fontSize: ".65rem", color: C.gray400}}>Paid: {new Date(a.payment.paidAt).toLocaleDateString()}</div>
                            )}
                          </td>
                          <td style={s.td}>
                            <Bdg type={a.status === "completed" || a.status === "approved" ? "green" : "blue"}>{a.status}</Bdg>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* DRILLDOWN VIEWS */}
        {drilldownLoading && (
          <div style={{ padding: 60, textAlign: "center", animation: "pulse 1.5s infinite" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: C.blue }}>Restoring detail view...</div>
            <p style={{ color: C.gray500, marginTop: 8 }}>Fetching information from server.</p>
          </div>
        )}

        {view === "patientDetail" && selectedPatient && !drilldownLoading && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <Btn variant="out" onClick={() => window.history.back()} style={{ marginBottom: 20 }}>&larr; Back to Patients</Btn>
            <SectionHead title={`${selectedPatient.firstName} ${selectedPatient.lastName}`} sub={selectedPatient.email} />
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, overflow: "hidden" }}>
              <div style={{ padding: 24, background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800 }}>Appointment History</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.white }}>
                      <th style={s.th}>Patient / Account</th>
                      <th style={s.th}>Demographics</th>
                      <th style={s.th}>Doctor/Clinic</th>
                      <th style={s.th}>Reason</th>
                      <th style={s.th}>Appt Date/Time</th>
                      <th style={s.th}>Booked At</th>
                      <th style={s.th}>Payment</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPatient.history?.map(a => (
                      <tr key={a._id} style={{ borderTop: `1px solid ${C.gray100}` }}>
                        <td style={s.td}>
                          <div style={{ fontSize: ".88rem", fontWeight: 800, color: C.gray900 }}>{a.patientName}</div>
                          {a.patientId && (
                            <div style={{ fontSize: ".72rem", color: C.blue, fontWeight: 700, marginTop: 2 }}>
                               {a.patientId.firstName} {a.patientId.lastName}
                            </div>
                          )}
                          {a.patientPhone && <div style={{fontSize: ".72rem", color: C.gray600, fontWeight: 700, marginTop: 2}}>{a.patientPhone}</div>}
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".78rem", color: C.gray700, marginTop: 4 }}>
                            Age: {a.patientAge || "N/A"} · {a.patientGender || "N/A"}
                            <br/>Addr: {a.patientAddress || "N/A"}
                          </div>
                        </td>
                        <td style={s.td}>
                          <strong>{a.doctorName || (`Dr. ${a.doctorId?.firstName} ${a.doctorId?.lastName}`)}</strong>
                          <br/><small style={{ color: C.gray500 }}>{a.clinicId?.name || "—"}</small>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".8rem", color: C.gray600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={a.reason}>{a.reason || "—"}</div>
                        </td>
                        <td style={s.td}>{a.date}<br/><small style={{ color: C.blue, fontWeight: 700 }}>{formatSlotRange(formatTime12(a.time), a.slotDuration)}</small></td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".76rem", color: C.gray800 }}>
                            {new Date(a.createdAt).toLocaleDateString()}<br/>
                            {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: ".88rem", fontWeight: 800, color: C.green }}>Rs.{a.total_fee}</div>
                          <small style={{ fontSize: ".65rem", color: C.gray400 }}>{a.payment?.status?.toUpperCase() || "PENDING"}</small>
                        </td>
                        <td style={s.td}><Bdg size="sm" type={a.status === "completed" || a.status === "approved" ? "green" : "blue"}>{a.status}</Bdg></td>
                      </tr>
                    ))}
                    {(!selectedPatient.history || selectedPatient.history.length === 0) && (
                      <tr><td colSpan="7" style={{ ...s.td, textAlign: "center", padding: 40, color: C.gray400 }}>No appointments yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === "clinicDetail" && selectedClinic && !drilldownLoading && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <Btn variant="out" onClick={() => window.history.back()} style={{ marginBottom: 20 }}>&larr; Back to Clinics</Btn>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: R.width < 640 ? "flex-start" : "flex-end", 
              flexDirection: R.width < 640 ? "column" : "row",
              gap: 20, 
              marginBottom: 32 
            }}>
              <div>
                <SectionHead title={selectedClinic.clinic.name} sub={`${selectedClinic.clinic.city}, ${selectedClinic.clinic.state}`} />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: R.width < 640 ? "100%" : "auto" }}>
                <div style={{ flex: R.width < 450 ? "1" : "none", background: C.white, padding: R.width < 450 ? "10px 16px" : "12px 24px", borderRadius: 12, border: `1px solid ${C.gray200}`, textAlign: R.width < 640 ? "left" : "right" }}>
                  <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Clinic Earnings</small>
                  <div style={{ fontSize: R.width < 450 ? "1rem" : "1.2rem", fontWeight: 900, color: C.green }}>Rs.{selectedClinic.totalClinicRevenue}</div>
                </div>
                <div style={{ flex: R.width < 450 ? "1" : "none", background: C.white, padding: R.width < 450 ? "10px 16px" : "12px 24px", borderRadius: 12, border: `1px solid ${C.gray200}`, textAlign: R.width < 640 ? "left" : "right" }}>
                  <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Admin Revenue</small>
                  <div style={{ fontSize: R.width < 450 ? "1rem" : "1.2rem", fontWeight: 900, color: C.blue }}>Rs.{selectedClinic.totalAdminRevenue}</div>
                </div>
                {(selectedClinic.totalClinicRevenue > 0 || selectedClinic.totalAdminRevenue > 0) && (
                  <button 
                    onClick={() => handleSettleClick(selectedClinic.clinic._id)}
                    style={{ 
                      flex: R.width < 640 ? "1 0 100%" : "none",
                      background: C.green, color: C.white, border: "none", borderRadius: 12, 
                      padding: "12px 24px", fontWeight: 800, cursor: "pointer", fontSize: ".85rem", 
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" 
                    }}
                  >
                    Pay & Settle
                  </button>
                )}
              </div>
            </div>

            {/* CLINIC FULL PROFILE SECTION */}
            <div style={{ display: "grid", gridTemplateColumns: R.width < 900 ? "1fr" : "repeat(2, 1fr)", gap: 24, marginBottom: 32 }}>
              <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: "1rem" }}>Clinic Contact Info</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <DetailRow label="Phone" value={selectedClinic.clinic.phone} />
                  <DetailRow label="Email" value={selectedClinic.clinic.email} />
                  <DetailRow label="Full Address" value={`${selectedClinic.clinic.address}, ${selectedClinic.clinic.city}, ${selectedClinic.clinic.state}`} />
                  <DetailRow label="Max Booking Window" value={`${selectedClinic.clinic.maxBookingDays} Days`} />
                </div>
              </div>
              <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: "1rem" }}>Business Details</h3>
                <div style={{ display: "grid", gap: 12 }}>
                   <div style={{ marginTop: 8 }}>
                    <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Description</small>
                    <p style={{ fontSize: ".85rem", color: C.gray600, marginTop: 4, lineHeight: 1.5, textAlign: "justify" }}>{selectedClinic.clinic.description || "No description provided."}</p>
                  </div>
                  {selectedClinic.clinic.documents && (
                    <div style={{ marginTop: 14 }}>
                      <a href={selectedClinic.clinic.documents} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: C.blue, color: C.white, padding: "8px 16px", borderRadius: 6, fontSize: ".8rem", fontWeight: 700, textDecoration: "none" }}>View Registration Documents</a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ position: "sticky", top: 10, zIndex: 10 }}>
              <Inp 
                placeholder="Search doctors in this clinic..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: R.isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
              {selectedClinic.doctorStats?.filter(d => 
                `${d.firstName} ${d.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
                d.specialty.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(d => (
                <AnimCard key={d._id} hoverable onClick={() => handleDoctorClick(d)}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ width: 60, height: 60, borderRadius: 12, background: C.gray100, overflow: "hidden" }}>
                      {d.photoUrl ? <img src={d.photoUrl} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} /> : <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:C.gray400, fontWeight:800}}>{d.firstName[0]}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: 800 }}>Dr. {d.firstName} {d.lastName}</h4>
                      <p style={{ color: C.gray500, fontSize: ".8rem" }}>{d.specialty} {d.expertise ? `(${d.expertise})` : ""} · {d.degree}</p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: R.width < 400 ? "1fr" : "1fr 1fr 1fr", gap: 12, marginTop: 16, borderTop: `1px solid ${C.gray100}`, paddingTop: 16 }}>
                    <div>
                      <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Appts</small>
                      <div style={{ fontWeight: 800, color: C.gray700 }}>{d.appointmentCount}</div>
                    </div>
                    <div>
                      <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Clinic Rs</small>
                      <div style={{ fontWeight: 800, color: C.green }}>Rs.{d.totalEarnings}</div>
                    </div>
                    <div>
                      <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Admin Rs</small>
                      <div style={{ fontWeight: 800, color: C.blue }}>Rs.{d.adminRevenue}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: ".8rem", color: C.blue, fontWeight: 700 }}>View Patient List &rarr;</div>
                </AnimCard>
              ))}
            </div>
          </div>
        )}

        {view === "doctorDetail" && selectedDoctor && !drilldownLoading && (
          <div style={{ animation: "fadeSlideUp .3s both" }}>
            <Btn variant="out" onClick={() => window.history.back()} style={{ marginBottom: 20 }}>&larr; Back to Clinic Stats</Btn>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexDirection: R.width < 500 ? "column" : "row", marginBottom: 32, background: C.white, padding: 24, borderRadius: 16, border: `1px solid ${C.gray200}` }}>
              <div style={{ width: 80, height: 80, borderRadius: 16, background: C.gray100, overflow: "hidden", flexShrink: 0 }}>
                {selectedDoctor.photoUrl ? <img src={selectedDoctor.photoUrl} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} /> : <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:C.gray400, fontWeight:800}}>{selectedDoctor.firstName[0]}</div>}
              </div>
              <div style={{ textAlign: R.width < 500 ? "center" : "left" }}>
                <h2 style={{ fontWeight: 800, fontSize: R.width < 400 ? "1.4rem" : "1.8rem" }}>Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</h2>
                <p style={{ color: C.gray500, fontSize: ".95rem" }}>{selectedDoctor.specialty} {selectedDoctor.expertise ? `(${selectedDoctor.expertise})` : ""} · {selectedDoctor.degree}</p>
              </div>
            </div>

            {/* DOCTOR FULL INFO */}
            <div style={{ display: "grid", gridTemplateColumns: R.width < 900 ? "1fr" : "repeat(2, 1fr)", gap: 24, marginBottom: 24 }}>
              <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: "1rem" }}>Professional Info</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <DetailRow label="Specialty" value={selectedDoctor.specialty} />
                  <DetailRow label="Expertise" value={selectedDoctor.expertise} />
                  <DetailRow label="Reg No" value={selectedDoctor.regNo} />
                  <DetailRow label="College" value={selectedDoctor.college} />
                  <DetailRow label="Experience" value={selectedDoctor.exp} />
                  <DetailRow label="Consultation Fee" value={`Rs.${selectedDoctor.fee}`} />
                  <DetailRow label="Gender" value={selectedDoctor.gender} />
                </div>
              </div>
              <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: "1rem" }}>Contact & Bio</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <DetailRow label="Email" value={selectedDoctor.email || "N/A"} />
                  <DetailRow label="Phone" value={selectedDoctor.phone} />
                  <div style={{ marginTop: 8 }}>
                    <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>Bio</small>
                    <p style={{ fontSize: ".85rem", color: C.gray600, marginTop: 4, lineHeight: 1.5, textAlign: "justify" }}>{selectedDoctor.bio || "No biography provided."}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* DOCTOR SCHEDULING INFO */}
            <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.gray200}`, marginBottom: 32 }}>
              <h3 style={{ fontWeight: 800, marginBottom: 20, fontSize: "1rem" }}>Availability & Scheduling</h3>
              <div style={{ display: "grid", gridTemplateColumns: R.width < 480 ? "1fr" : R.width < 900 ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 20 }}>
                <div>
                  <DetailRow label="Slot Duration" value={`${selectedDoctor.slotDuration || 30} Mins`} />
                  <div style={{ marginTop: 12 }}>
                    <DetailRow label="Booking Cutoff" value={selectedDoctor.bookingCutoffDay === "same_day" ? `Same Day (${selectedDoctor.tomorrowBookingCutoffTime || "None"})` : "Previous Day"} />
                  </div>
                </div>
                {[
                  { label: "Morning", active: selectedDoctor.morningActive, start: selectedDoctor.morningStartTime, end: selectedDoctor.morningEndTime },
                  { label: "Afternoon", active: selectedDoctor.afternoonActive, start: selectedDoctor.afternoonStartTime, end: selectedDoctor.afternoonEndTime },
                  { label: "Evening", active: selectedDoctor.eveningActive, start: selectedDoctor.eveningStartTime, end: selectedDoctor.eveningEndTime },
                  { label: "Night", active: selectedDoctor.nightActive, start: selectedDoctor.nightStartTime, end: selectedDoctor.nightEndTime }
                ].map(shift => (
                  <div key={shift.label} style={{ opacity: shift.active ? 1 : 0.4 }}>
                    <small style={{ color: C.gray400, fontWeight: 700, textTransform: "uppercase", fontSize: ".65rem" }}>{shift.label} Shift</small>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: shift.active ? C.green : C.gray300 }}></div>
                      <span style={{ fontSize: ".85rem", fontWeight: 700, color: shift.active ? C.gray900 : C.gray400 }}>
                        {shift.active ? `${formatTime12(shift.start)} - ${formatTime12(shift.end)}` : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.gray200}`, overflow: "hidden" }}>
              <div style={{ padding: 24, background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                <h3 style={{ fontWeight: 800 }}>Patients List</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: C.white }}>
                      <th style={s.th}>Patient / Account</th>
                      <th style={s.th}>Demographics</th>
                      <th style={s.th}>Reason</th>
                      <th style={s.th}>Appt Date/Time</th>
                      <th style={s.th}>Booked At</th>
                      <th style={s.th}>Payment (T/C/A)</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                      {selectedDoctor.history?.map(a => (
                        <tr key={a._id} style={{ borderTop: `1px solid ${C.gray100}` }}>
                          <td style={s.td}>
                            <div style={{fontWeight: 800, color: C.gray900}}>{a.patientName}</div>
                            {a.patientPhone && <div style={{fontSize: ".75rem", color: C.blue, fontWeight: 700}}>{a.patientPhone}</div>}
                            {a.patientId && (
                                <div style={{fontSize: ".75rem", color: C.blue, marginTop: 4, fontWeight: 700}}>
                                    {a.patientId.firstName} {a.patientId.lastName}
                                </div>
                            )}
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".78rem", color: C.gray700}}>
                              Age: {a.patientAge || "N/A"} · {a.patientGender || "N/A"}
                              <br/>{a.patientAddress || "No address"}
                            </div>
                          </td>
                          <td style={s.td}>
                            <p style={{fontSize: ".8rem", color: C.gray600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} title={a.reason}>{a.reason || "—"}</p>
                          </td>
                          <td style={s.td}>
                             {a.date}
                             <br/><small style={{color: C.blue, fontWeight: 700}}>{formatSlotRange(formatTime12(a.time), a.slotDuration)}</small>
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".8rem", color: C.gray800}}>
                                {new Date(a.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={s.td}>
                            <div style={{fontSize: ".88rem", fontWeight: 800, color: C.green}}>Rs.{a.total_fee}</div>
                            <small style={{fontSize: ".68rem", color: C.gray500}}>Clinic: Rs.{a.clinic_earning} / Admin: Rs.{a.admin_commission}</small>
                          </td>
                          <td style={s.td}>
                            <Bdg type={a.status === "completed" || a.status === "approved" ? "green" : "blue"}>{a.status}</Bdg>
                          </td>
                        </tr>
                      ))}
                    {(!selectedDoctor.history || selectedDoctor.history.length === 0) && (
                      <tr><td colSpan="7" style={{ ...s.td, textAlign: "center", padding: 40, color: C.gray400 }}>No patient records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
