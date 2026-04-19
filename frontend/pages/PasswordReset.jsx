import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/api";
import { Btn, Inp, AuthWrap } from "../components/shared/UI";
import C from "../constants/colors";

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const token = searchParams.get("token");
  const role = searchParams.get("role");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token || !role) {
      setMsg("Invalid or missing reset token. Please request a new link.");
    }
  }, [token, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setMsg("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await resetPassword({ token, role, newPassword: password });
      setMsg(res.message || "Password reset successfully!");
      setSuccess(true);
      setTimeout(() => {
        navigate(role === "patient" ? "/patient/auth" : "/clinic/auth");
      }, 3000);
    } catch (err) {
      setMsg(err.message || "Error resetting password");
    }
    setLoading(false);
  };

  return (
    <AuthWrap narrow>
      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: C.gray900, marginBottom: 8 }}>
        Reset Password
      </div>
      <p style={{ color: C.gray500, fontSize: ".85rem", marginBottom: 20 }}>
        Please enter your new password below.
      </p>

      {msg && (
        <div style={{
          background: success ? "#dcfce7" : "#fee2e2",
          color: success ? "#166534" : "#991b1b",
          padding: "12px 16px", borderRadius: 8, fontSize: ".85rem", fontWeight: 600, marginBottom: 20
        }}>
          {msg}
        </div>
      )}

      {!success && token && role && (
        <form onSubmit={handleSubmit}>
          <Inp 
            label="New Password" 
            type="password" 
            placeholder="Min. 8 characters" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          <Inp 
            label="Confirm New Password" 
            type="password" 
            placeholder="Repeat your password" 
            value={confirm} 
            onChange={e => setConfirm(e.target.value)} 
          />
          <Btn type="submit" full disabled={loading}>
            {loading ? "Resetting..." : "Update Password"}
          </Btn>
        </form>
      )}

      {(!token || !role) && (
        <Btn onClick={() => navigate("/")} full color="out">Return Home</Btn>
      )}

      <p style={{ textAlign: "center", marginTop: 24, fontSize: ".82rem", color: C.gray500 }}>
        Remembered your password?{" "}
        <span 
          style={{ cursor: "pointer", color: C.blue, fontWeight: 700 }} 
          onClick={() => navigate(role === "patient" ? "/patient/auth" : "/clinic/auth")}
        >
          Sign In
        </span>
      </p>
    </AuthWrap>
  );
}
