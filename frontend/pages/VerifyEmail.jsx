import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../services/api";
import { AuthWrap, Btn } from "../components/shared/UI";
import { useAuth } from "../context/AuthContext";
import C from "../constants/colors";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const hasFired = useRef(false);

  const token = searchParams.get("token")?.trim();
  const role = searchParams.get("role")?.trim();

  useEffect(() => {
    if (hasFired.current) return;
    if (!token || !role) {
      setStatus({ type: "error", msg: "Invalid verification link. Missing parameters." });
      setLoading(false);
      return;
    }

    async function doVerify() {
      hasFired.current = true;
      try {
        const res = await verifyEmail(token, role);
        setStatus({ type: "success", msg: res.message });
        showToast("Email verified successfully!");
      } catch (err) {
        setStatus({ 
          type: "error", 
          msg: err.message || "Verification failed",
          details: err.data?.details 
        });
      } finally {
        setLoading(false);
      }
    }

    doVerify();
  }, [token, role, showToast]);

  return (
    <AuthWrap narrow>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <h2 style={{ marginBottom: 16 }}>Email Verification</h2>

        {loading ? (
          <p style={{ color: C.gray500 }}>Verifying your email, please wait...</p>
        ) : (
          <div>
            <div
              style={{
                background: status.type === "success" ? "#ecfdf5" : "#fef2f2",
                color: status.type === "success" ? "#065f46" : "#991b1b",
                padding: 16,
                borderRadius: 8,
                marginBottom: 24,
                fontWeight: 600,
                fontSize: ".9rem",
                lineHeight: 1.5
              }}
            >
              {status.msg}
            </div>

            <Btn full onClick={() => navigate("/")}>
              Go to Login
            </Btn>
          </div>
        )}
      </div>
    </AuthWrap>
  );
}
