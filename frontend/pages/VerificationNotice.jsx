import { useState, useEffect } from "react";
import { AuthWrap, Btn } from "../components/shared/UI";
import { useAuth } from "../context/AuthContext";
import { resendVerification } from "../services/api";
import C from "../constants/colors";

export default function VerificationNotice() {
  const { session, token, showToast, logout, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [success, setSuccess] = useState(false);

  // Polling for verification status
  useEffect(() => {
    if (session?.isEmailVerified) return;
    
    const interval = setInterval(async () => {
      await refreshProfile();
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.isEmailVerified, refreshProfile]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setSuccess(false);
    try {
      const res = await resendVerification(token);
      showToast(res.message);
      setSuccess(true);
      setCooldown(60);
      
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => setSuccess(false), 3000); // Reset success text after 3s
    } catch (err) {
      showToast(err.message || "Failed to resend link", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthWrap narrow>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <h2 style={{ marginBottom: 12 }}>Verify Your Email</h2>
        <p style={{ color: C.gray600, fontSize: ".95rem", lineHeight: 1.6, marginBottom: 24 }}>
          Hi <strong>{session?.name?.split(" ")[0]}</strong>, you're almost there! 
          We've sent a verification link to <strong>{session?.email}</strong>. 
          Please check your inbox (and spam) to activate your account.
        </p>

        <Btn 
          full 
          onClick={handleResend} 
          disabled={loading || cooldown > 0}
          color={success ? "green" : cooldown > 0 ? "gray" : "blue"}
          style={{ 
            marginBottom: 12, 
            transition: "all .3s ease",
            transform: success ? "scale(1.02)" : "scale(1)"
          }}
        >
          {loading ? "Sending..." : success ? "Email Sent!" : cooldown > 0 ? `Resend again in ${cooldown}s` : "Resend Verification Link"}
        </Btn>

        <p 
          style={{ color: C.gray500, fontSize: ".85rem", cursor: "pointer", textDecoration: "underline" }}
          onClick={logout}
        >
          Want to use a different account? Logout
        </p>
      </div>
    </AuthWrap>
  );
}
