import { useState } from "react";
import C from "../../constants/colors";
import s from "../../constants/styles";
import DynamicLogo from "./DynamicLogo";

// ── Button ──
export function Btn({
  color = "blue",
  sm,
  full,
  onClick,
  children,
  disabled,
  style = {},
  type = "button",
  loading
}) {
  const [isHover, setIsHover] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const colorMap = {
    blue: s.btnBlue,
    red: s.btnRed,
    green: s.btnGreen,
    amber: s.btnAmber,
    out: s.btnOut,
    gray: s.btnGray,
  };

  const combined = {
    ...s.btn,
    ...(colorMap[color] || s.btnBlue),
    ...(sm ? s.btnSm : {}),
    ...(full ? s.btnFull : {}),
    ...style,
    transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)",
    transform: isActive && !disabled ? "scale(0.96)" : isHover && !disabled ? "scale(1.02)" : "scale(1)",
    filter: isActive && !disabled ? "brightness(0.9)" : isHover && !disabled ? "brightness(1.1)" : "none",
    boxShadow: isHover && !disabled ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
  };

  return (
    <button
      type={type}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => { setIsHover(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        ...combined,
        opacity: (disabled || loading) ? 0.6 : 1,
        cursor: (disabled || loading) ? "not-allowed" : "pointer"
      }}
      onClick={(disabled || loading) ? undefined : onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div className="spinner-mini" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: C.white, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          <span>Please wait...</span>
        </div>
      ) : children}
    </button>
  );
}

// ── Text / Number Input ──
export function Inp({ label, type, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div style={s.fg}>
      {label && <label style={s.lbl}>{label}</label>}
      <div style={{ position: "relative" }}>
        <input
          style={{ ...s.inp, ...(isPassword ? { paddingRight: 40 } : {}) }}
          type={isPassword && showPassword ? "text" : (type || "text")}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.gray400,
            }}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              // Eye-off icon (password visible → click to hide)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // Eye icon (password hidden → click to show)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Select ──
export function Sel({ label, options, ...props }) {
  return (
    <div style={s.fg}>
      {label && <label style={s.lbl}>{label}</label>}
      <select style={s.inp} {...props}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Badge ──
export function Bdg({ type, status, children, blue, sm, red, green, amber }) {
  // If a 'status' prop is passed, map it to a color + label automatically
  if (status) {
    const statusMap = {
      approved:  { style: s.bdgGreen, label: "Approved" },
      completed: { style: s.bdgBlue,  label: "Completed" },
      cancelled: { style: s.bdgRed,   label: "Cancelled" },
      pending:   { style: s.bdgAmber, label: "Pending" },
    };
    const mapped = statusMap[status] || { style: s.bdgBlue, label: status };
    return <span style={mapped.style}>{children || mapped.label}</span>;
  }

  // Legacy: manual type or bool prop usage
  const styleMap = {
    green: s.bdgGreen,
    red: s.bdgRed,
    blue: s.bdgBlue,
    amber: s.bdgAmber,
  };
  let resolvedType = type;
  if (!resolvedType) {
    if (green) resolvedType = "green";
    else if (red) resolvedType = "red";
    else if (amber) resolvedType = "amber";
    else resolvedType = "blue";
  }
  return <span style={{ ...(styleMap[resolvedType] || s.bdgBlue), ...(sm ? { fontSize: ".65rem", padding: "2px 8px" } : {}) }}>{children}</span>;
}

// ── Qualification Row (key/value pair) ──
export function QualRow({ label, value, highlight }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: highlight ? "3px 6px" : "5px 0",
        borderBottom: `1px solid ${C.gray100}`,
        fontSize: ".8rem",
        ...(highlight ? { background: "#fef3c7", borderRadius: 4 } : {}),
      }}
    >
      <span
        style={{ color: highlight ? "#92400e" : C.gray500, fontWeight: 700 }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 700, color: highlight ? C.blue : "inherit" }}>
        {value || "--"}
      </span>
    </div>
  );
}

// ── Tab Buttons ──
export function TabBtns({ tabs, active, onTab, onChange }) {
  const handler = onChange || onTab;
  return (
    <div
      style={{
        display: "flex",
        background: C.gray100,
        borderRadius: 8,
        padding: 4,
        gap: 4,
        marginBottom: 16,
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}
    >
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
      {tabs.map((t) => {
        const id = typeof t === "object" ? t.id : t;
        const label = typeof t === "object" ? t.label : t;
        return (
          <button
            key={id}
            onClick={() => handler(id)}
            style={{
              flex: "1 0 auto",
              padding: "10px 16px",
              border: "none",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: ".8rem",
              cursor: "pointer",
              borderRadius: 6,
              background: active === id ? C.blue : "transparent",
              color: active === id ? C.white : C.gray500,
              whiteSpace: "nowrap",
              transition: "all .2s ease"
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sidebar Item ──
export function SidebarItem({ icon, label, active, danger, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...s.sideItem,
        background: active ? C.blueLt : "transparent",
        color: danger ? C.red : active ? C.blue : C.gray500,
        borderLeft: active ? `3px solid ${C.blue}` : "3px solid transparent",
        fontWeight: active ? 700 : 600,
      }}
    >
      {icon} {label}
    </div>
  );
}

// ── Auth Wrapper ──
export function AuthWrap({ narrow, children }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 16px",
        background: C.gray100,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: narrow ? 400 : 560 }}>
        <div style={{ marginBottom: 18 }}>
          <DynamicLogo width="300px" />
        </div>
        <div style={{ ...s.card, width: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Toast ──
export function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        background: type === "err" ? "#991b1b" : "#166534",
        color: C.white,
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: ".83rem",
        fontWeight: 600,
        zIndex: 9999,
        maxWidth: 300,
      }}
    >
      {msg}
    </div>
  );
}
//import "./Footer.css";
// ── Footer ──
export function Footer() {
  return (
    <footer
      className="footer"
      style={{
        background: C.gray100,
        color: C.gray500,
        textAlign: "center",
        padding: "16px 14px",
        fontSize: ".77rem",
        flexShrink: 0,
        borderTop: `1px solid ${C.gray200}`,
        transition: "all .3s ease"
      }}
    >
      <strong style={{ color: C.gray900 }}>Tym4DOC</strong> — Booking System
    </footer>
  );
}
