import useResponsive from "../hooks/useResponsive";
import DynamicLogo from "../components/shared/DynamicLogo";
import C from "../constants/colors";

export default function Landing({ onRole, onAdminClick }) {
  const R = useResponsive();
  const roleCards = [
    { role:"patient", icon:"Patient", title:"Patient", desc:"Search clinics, find doctors, book appointments", color: C.green },
    { role:"clinic",  icon:"Clinic",  title:"Clinic",  desc:"Register your clinic, add doctors, manage bookings", color: C.green },
  ];

  return (
    <div style={{
      background: C.gray50,
      flex:1,
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      justifyContent:"center",
      padding:"32px 20px",
      textAlign:"center",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <DynamicLogo />
      </div>

      {/* Subtitle */}
      <p style={{ color: C.gray500, fontSize:".95rem", maxWidth:420, margin:"0 auto 40px" }}>
        Book appointments with verified doctors at trusted clinics & hospitals.
      </p>

      {/* Role Cards */}
      <div style={{ display:"grid", gridTemplateColumns: R.isMobile ? "1fr" : "1fr 1fr", gap:16, maxWidth:500, width:"100%" }}>
        {roleCards.map(card => (
          <div
            key={card.role}
            onClick={() => onRole(card.role)}
            style={{
              background: C.white,
              border: `1px solid ${C.gray200}`,
              borderRadius: 8,
              padding:"32px 20px",
              cursor:"pointer",
              transition: "all .2s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = card.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.gray200}
          >
            <div style={{ fontSize:"1.4rem", fontWeight: 900, color: card.color, marginBottom:12 }}>{card.icon}</div>
            <p style={{ color: C.gray500, fontSize:".85rem", lineHeight: 1.5 }}>{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Admin Link */}
      <div style={{ marginTop: 24, fontSize:".85rem", color: C.gray500 }}>
        Authorized personnel?{" "}
        <span
          onClick={onAdminClick}
          style={{ color: C.blue, fontWeight: 700, cursor:"pointer" }}
        >
          Admin Sign In
        </span>
      </div>
    </div>
  );
}
