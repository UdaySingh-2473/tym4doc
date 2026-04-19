import { useState } from "react";
import useResponsive from "../hooks/useResponsive";
import s from "../constants/styles";
import C from "../constants/colors";
import { Btn, Inp, TabBtns, AuthWrap } from "../components/shared/UI";
import { forgotPassword, resetPassword } from "../services/api";

export default function PatientAuth({ onBack, onLogin }) {
  const R = useResponsive();
  const [tab,   setTab]   = useState("Sign In");
  // Login fields
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  // Register fields
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [rpass, setRpass] = useState("");
  const [remail,setRemail]= useState("");

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [fpMsg, setFpMsg] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [successSent, setSuccessSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !pass) {
      alert("Please enter both email and password");
      return;
    }
    setIsSubmitting(true);
    await onLogin({ type: "login", email, pass });
    setIsSubmitting(false);
  }

  async function handleRegister() {
    if (!fname || !lname || !remail || !rpass) {
      alert("Please fill all required fields");
      return;
    }
    if (rpass.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    setIsSubmitting(true);
    await onLogin({ type: "register", fname, lname, email: remail, pass: rpass });
    setIsSubmitting(false);
  }

  async function handleFpSendLink() {
    if (!fpEmail) { setFpMsg("Please enter your email"); return; }
    setFpLoading(true); setFpMsg("");
    try {
      const res = await forgotPassword(fpEmail, "patient");
      setFpMsg(res.message || "Reset link sent!");
      setSuccessSent(true);
    } catch (err) { setFpMsg(err.message || "Error sending link"); }
    setFpLoading(false);
  }

  return (
    <AuthWrap narrow>
      {/* Back */}
      <span
        style={{ color:C.gray400, fontSize:".82rem", fontWeight:600, cursor:"pointer", marginBottom:12, display:"inline-block" }}
        onClick={onBack}
      >
        ← Back
      </span>

      {/* ── Sign In ── */}
      {tab === "Sign In" && (
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>Patient Sign In</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:16 }}>Welcome back!</div>

          <Inp label="Email"    type="email"    placeholder="your email" value={email} onChange={e => setEmail(e.target.value)} />
          <Inp label="Password" type="password" placeholder="password"   value={pass}  onChange={e => setPass(e.target.value)}  />

          <Btn type="submit" full disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Sign In"}
          </Btn>

          <p style={{ textAlign:"center", marginTop:11, fontSize:".81rem", color:C.gray500 }}>
            No account?{" "}
            <span style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Register")}>Register</span>
            {" · "}
            <span style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Forgot Password")}>Forgot Password?</span>
          </p>
          <div style={s.infoBox}>Please register first, then sign in with your credentials.</div>
        </form>
      )}

      {/* ── Register ── */}
      {tab === "Register" && (
        <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>Create Patient Account</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:16 }}>Join Tym4DOC</div>

          <div style={R.g2}>
            <Inp label="First Name" placeholder="Riya"   value={fname} onChange={e => setFname(e.target.value)} />
            <Inp label="Last Name"  placeholder="Sharma" value={lname} onChange={e => setLname(e.target.value)} />
          </div>
          <Inp label="Email" type="email" placeholder="your email"        value={remail} onChange={e => setRemail(e.target.value)} />
          <Inp label="Password" type="password" placeholder="Min. 8 characters" value={rpass} onChange={e => setRpass(e.target.value)} />

          <Btn type="submit" full disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Create Account"}
          </Btn>

          <p style={{ textAlign:"center", marginTop:11, fontSize:".81rem", color:C.gray500 }}>
            Have account?{" "}
            <span type="button" style={{ cursor:"pointer", color:C.blue }} onClick={() => setTab("Sign In")}>Sign In</span>
          </p>
        </form>
      )}

      {/* ── Forgot Password ── */}
      {tab === "Forgot Password" && (
        <form onSubmit={(e) => { e.preventDefault(); handleFpSendLink(); }}>
          <div style={{ fontSize:"1.15rem", fontWeight:700, marginBottom:3 }}>Reset Password</div>
          <div style={{ color:C.gray500, fontSize:".83rem", marginBottom:16 }}>
            {!successSent ? "Enter your registered email to receive a password reset link." : "Check your inbox for a link to reset your password."}
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
              <Inp label="Email" type="email" placeholder="your registered email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} />
              <Btn type="submit" full disabled={fpLoading}>
                {fpLoading ? "Sending Link..." : "Send Reset Link"}
              </Btn>
            </>
          ) : (
            <Btn type="button" full color="out" onClick={() => setTab("Sign In")}>Back to Sign In</Btn>
          )}

          <p style={{ textAlign:"center", marginTop:14, fontSize:".81rem", color:C.gray500 }}>
            Remember your password?{" "}
            <span style={{ cursor:"pointer", color:C.blue, fontWeight: 700 }} onClick={() => { setTab("Sign In"); setFpMsg(""); setSuccessSent(false); }}>Sign In</span>
          </p>
        </form>
      )}
    </AuthWrap>
  );
}
