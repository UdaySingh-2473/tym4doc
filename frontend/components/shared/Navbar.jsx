import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import C from "../../constants/colors";
import s from "../../constants/styles";
import { Btn } from "./UI";
import DynamicLogo from "./DynamicLogo";
import useResponsive from "../../hooks/useResponsive";

export default function Navbar({ session, onHome, onLogout, theme }) {
  const R = useResponsive();
  
  const isGuest = !session?.role;

  const signOutBtnStyle = {
    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    color: "#ffffff",
    border: "none",
    boxShadow: "0 2px 4px rgba(185, 28, 28, 0.2)",
    transition: "all 0.2s ease"
  };

  return (
    <nav style={{ 
      ...s.nav, 
      flexWrap: "nowrap", 
      position: "relative",
      padding: R.width < 350 ? "10px 8px" : "10px 16px"
    }}>
      {/* Logo */}
      <div style={{ ...s.logo, display:"flex", alignItems:"center" }} onClick={onHome}>
        <DynamicLogo width="160px" />
      </div>

      {/* Right side */}
      <div style={{ display:"flex", gap:14, alignItems:"center", marginLeft: "auto" }}>
        {!isGuest && (
          <Btn 
            sm 
            onClick={onLogout} 
            style={{ ...signOutBtnStyle, padding: R.isMobile ? "6px 12px" : "8px 16px" }}
          >
            Sign Out
          </Btn>
        )}
      </div>
    </nav>
  );
}
