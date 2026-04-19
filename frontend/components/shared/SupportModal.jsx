import { useState } from "react";
import C from "../../constants/colors";
import { Btn, Inp } from "./UI";
import { submitSupport } from "../../services/api";

export default function SupportModal({ isOpen, onClose, token }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !message) return setError("Please fill all fields");
    
    setLoading(true);
    setError("");
    try {
      await submitSupport({ subject, message }, token);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSubject("");
        setMessage("");
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to send request");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
      zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "fadeIn .2s ease"
    }}>
      <div style={{
        background: C.white, borderRadius: 16, width: "100%", maxWidth: 450,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        overflow: "hidden", animation: "fadeSlideUp .3s ease"
      }}>
        <div style={{ background: "#0d9488", padding: "20px 24px", color: C.white }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>Help & Support</h2>
          <p style={{ fontSize: ".850rem", opacity: 0.9, marginTop: 4 }}>We're here to help you. Send us your query.</p>
        </div>

        <div style={{ padding: 24 }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#065f46" }}>Request Sent!</h3>
              <p style={{ color: C.gray500, fontSize: ".9rem" }}>We'll get back to you shortly via email.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: ".75rem", fontWeight: 800, color: C.gray500, marginBottom: 6, display: "block", textTransform: "uppercase" }}>Subject</label>
                <Inp 
                  placeholder="What do you need help with?" 
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: ".75rem", fontWeight: 800, color: C.gray500, marginBottom: 6, display: "block", textTransform: "uppercase" }}>Description</label>
                <textarea
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.gray200}`,
                    fontSize: ".9rem", fontFamily: "inherit", minHeight: 120, resize: "vertical",
                    outline: "none", transition: "all .2s"
                  }}
                  placeholder="Describe your issue in detail..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  disabled={loading}
                  onFocus={e => e.target.style.borderColor = "#0d9488"}
                  onBlur={e => e.target.style.borderColor = C.gray200}
                />
              </div>

              {error && (
                <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, fontSize: ".85rem", fontWeight: 600, marginBottom: 16, border: "1px solid #fee2e2" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 8, border: "none",
                    background: C.red, fontWeight: 700, cursor: "pointer", fontSize: ".9rem", color: C.white
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <Btn
                  loading={loading}
                  style={{ flex: 1, height: 46 }}
                  type="submit"
                >
                  Send Request
                </Btn>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupportFAB({ onClick }) {
  const [hover, setHover] = useState(false);
  
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 10000,
        padding: "6px 14px", borderRadius: 16,
        background: "#0d9488", color: C.white, border: "none",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: hover ? "0 10px 24px rgba(13, 148, 136, 0.4)" : "0 6px 12px rgba(0, 0, 0, 0.15)",
        transition: "all .3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hover ? "scale(1.05) translateY(-2px)" : "scale(1)",
        fontWeight: 700,
        fontSize: ".75rem",
        letterSpacing: ".03em",
        textTransform: "uppercase"
      }}
    >
      Help
    </button>
  );
}
