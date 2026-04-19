import { useState, useEffect } from "react";
import useResponsive from "../hooks/useResponsive";
import s from "../constants/styles";
import C from "../constants/colors";
import { Btn, Inp, TabBtns, AuthWrap } from "../components/shared/UI";
import { forgotPassword, resetPassword } from "../services/api";

export default function ClinicAuth({ onBack, onLogin }) {
  const [tab, setTab] = useState("Login");
  const R = useResponsive();

  // Login fields
  const [lEmail, setLEmail] = useState("");
  const [lPass,  setLPass]  = useState("");
  const [lRole,  setLRole]  = useState("clinic"); // clinic or doctor

  // Register fields
  const [r, setR] = useState({
    name:"", email:"", phone:"", address:"", city:"", state:"",
    lat:"", lng:"", documents:"", description:"", pass:"", pass2:""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedR = localStorage.getItem("clinicRegForm");
    if (savedR) {
      try {
        const parsed = JSON.parse(savedR);
        setR(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, []);

  const setF = key => e => {
    let val = e.target.value;
    if (key === "phone") val = val.replace(/\D/g, "").slice(0, 10);
    setR(prev => {
      const nextR = { ...prev, [key]: val };
      localStorage.setItem("clinicRegForm", JSON.stringify(nextR));
      return nextR;
    });
  };

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [fpMsg, setFpMsg] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [successSent, setSuccessSent] = useState(false);

  async function handleLogin() {
    if (!lEmail || !lPass) {
      alert("Please enter both email and password");
      return;
    }
    setIsSubmitting(true);
    await onLogin({ type: lRole === "doctor" ? "doctorLogin" : "clinicLogin", email: lEmail, pass: lPass });
    setIsSubmitting(false);
  }

  async function handleRegister() {
    if (!r.name || !r.email || !r.phone || !r.address || !r.city || !r.state || !r.pass || !r.pass2) {
      alert("Please fill all required fields");
      return;
    }
    if (!/^\d{10}$/.test(r.phone)) {
      alert("Phone number must be exactly 10 digits");
      return;
    }
    if (r.pass.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    if (r.pass !== r.pass2) {
      alert("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    await onLogin({ type:"clinicRegister", ...r });
    setIsSubmitting(false);
    // On success, the session changes and unmounts, but if it stays, we could clear local storage based on success response, but context shows toast directly. If they succeed we should ideally clear it, but let's just clear it on login.
  }

  async function handleFpSendLink() {
    if (!fpEmail) { setFpMsg("Please enter your email"); return; }
    setFpLoading(true); setFpMsg("");
    try {
      const res = await forgotPassword(fpEmail, lRole);
      setFpMsg(res.message || "Reset link sent!");
      setSuccessSent(true);
    } catch (err) { setFpMsg(err.message || "Error sending link"); }
    setFpLoading(false);
  }

  return (
    <AuthWrap>
      <span style={{ color:C.gray400, fontSize:".82rem", fontWeight:600, cursor:"pointer", marginBottom:12, display:"inline-block" }} onClick={onBack}>
        ← Back
      </span>

      {tab === "Login" && (
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, background: C.gray100, padding: 4, borderRadius: 8 }}>
            <button 
              type="button" 
              onClick={() => setLRole("clinic")} 
              style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: lRole === "clinic" ? C.white : "transparent", color: lRole === "clinic" ? C.blue : C.gray500, fontWeight: 700, cursor: "pointer", boxShadow: lRole === "clinic" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
            >
              Clinic Login
            </button>
            <button 
              type="button" 
              onClick={() => setLRole("doctor")} 
              style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: lRole === "doctor" ? C.white : "transparent", color: lRole === "doctor" ? C.blue : C.gray500, fontWeight: 700, cursor: "pointer", boxShadow: lRole === "doctor" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
            >
              Doctor Login
            </button>
          </div>

          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>{lRole === "doctor" ? "Doctor" : "Clinic"} Sign In</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:16 }}>Access your dashboard.</div>

          <Inp label="Email"    type="email"    placeholder="clinic email" value={lEmail} onChange={e => setLEmail(e.target.value)} />
          <Inp label="Password" type="password" placeholder="password"     value={lPass}  onChange={e => setLPass(e.target.value)}  />

          <Btn type="submit" full disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Sign In to Dashboard"}
          </Btn>

          <p style={{ textAlign:"center", marginTop:11, fontSize:".81rem", color:C.gray500 }}>
            Not registered? <span style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Register as Clinic")}>Register here</span>
            {" · "}
            <span style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Forgot Password")}>Forgot Password?</span>
          </p>
        </form>
      )}

      {tab === "Register as Clinic" && (
        <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>Clinic Registration</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:8 }}>
            Submit details for admin verification. You go live only after approval.
          </div>

          <div style={R.g2}>
            <Inp label="Clinic Name" placeholder="Clinic" value={r.name} onChange={setF("name")} />
            <Inp label="Email" type="email" placeholder="email" value={r.email} onChange={setF("email")} />
          </div>
          <div style={R.g2}>
            <Inp label="Phone" type="tel" maxLength="10" placeholder="10-digit number" value={r.phone} onChange={setF("phone")} />
            <Inp label="Address" placeholder="123 MG Road" value={r.address} onChange={setF("address")} />
          </div>
          <div style={R.g2}>
            <Inp label="City" placeholder="Kurukshetra" value={r.city} onChange={setF("city")} />
            <Inp label="State" placeholder="Haryana" value={r.state} onChange={setF("state")} />
          </div>
          
          <Inp label="Description" placeholder="Short description of the clinic" value={r.description} onChange={setF("description")} />
          <Inp label="Documents URL (Optional)" placeholder="Drive link to verified docs" value={r.documents} onChange={setF("documents")} />

          <div style={R.g2}>
            <Inp label="Password" type="password" placeholder="Min. 8 characters" value={r.pass} onChange={setF("pass")} />
            <Inp label="Confirm Password" type="password" placeholder="Repeat password" value={r.pass2} onChange={setF("pass2")} />
          </div>

          <Btn type="submit" full disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Submit for Admin Verification"}
          </Btn>

          <p style={{ textAlign:"center", marginTop:11, fontSize:".81rem", color:C.gray500 }}>
            Already registered? <span style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Login")}>Sign In</span>
          </p>
        </form>
      )}

      {/* ── Forgot Password ── */}
      {tab === "Forgot Password" && (
        <form onSubmit={(e) => { e.preventDefault(); handleFpSendLink(); }}>
          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>Reset {lRole === "doctor" ? "Doctor" : "Clinic"} Password</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:16 }}>
            {!successSent ? `Enter your registered ${lRole} email to receive a password reset link.` : `Check your ${lRole} email for a link to reset your password.`}
          </div>

          {fpMsg && (
            <div style={{
              background: fpMsg.includes("sent") || fpMsg.includes("success") ? "#dcfce7" : "#fee2e2",
              color: fpMsg.includes("sent") || fpMsg.includes("success") ? "#166534" : "#991b1b",
              padding: "12px 16px", borderRadius: 8, fontSize: ".82rem", fontWeight: 600, marginBottom: 14
            }}>
              {fpMsg}
            </div>
          )}

          {!successSent ? (
            <>
              <Inp label={`${lRole === "doctor" ? "Doctor" : "Clinic"} Email`} type="email" placeholder="your registered email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} />
              <Btn type="submit" full disabled={fpLoading}>
                {fpLoading ? "Sending Link..." : "Send Reset Link"}
              </Btn>
            </>
          ) : (
            <Btn type="button" full color="out" onClick={() => setTab("Login")}>Back to Login</Btn>
          )}

          <p style={{ textAlign:"center", marginTop:14, fontSize:".81rem", color:C.gray500 }}>
            Remember your password?{" "}
            <span style={{ cursor:"pointer", color:C.blue, fontWeight: 700 }} onClick={() => { setTab("Login"); setFpMsg(""); setSuccessSent(false); }}>Sign In</span>
          </p>
        </form>
      )}
    </AuthWrap>
  );
}
