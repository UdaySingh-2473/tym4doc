import { useState, useEffect } from "react";

export default function useResponsive() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile:  width < 640,
    isTablet:  width < 900,
    isDesktop: width >= 900,
    width,
    // responsive style helpers
    g2:      width < 640 ? { display:"grid", gridTemplateColumns:"1fr",           gap:12, marginBottom:13 }
                         : { display:"grid", gridTemplateColumns:"1fr 1fr",        gap:12, marginBottom:13 },
    g3:      width < 640 ? { display:"grid", gridTemplateColumns:"1fr",           gap:14 }
           : width < 900 ? { display:"grid", gridTemplateColumns:"1fr 1fr",       gap:14 }
                         : { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 },
    dashWrap: width < 768
      ? { width:"100%", padding:"12px 10px", display:"flex", flexDirection:"column", gap:10, boxSizing:"border-box" }
      : { width:"100%", maxWidth:"100%", padding:"18px 16px", display:"grid", gridTemplateColumns:"190px 1fr", gap:14, boxSizing:"border-box" },
    slotGrid: width < 480 ? "repeat(2,1fr)" : width < 640 ? "repeat(3,1fr)" : "repeat(4,1fr)",
    cardPad:  width < 640 ? 14 : 20,
  };
}
