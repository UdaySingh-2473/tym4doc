import C from "./colors";

const s = {
  // layout
  page:     { minHeight:"100vh", display:"flex", flexDirection:"column", background:C.gray50, fontFamily:"system-ui,-apple-system,Arial,sans-serif", fontSize:15, color:C.gray900 },
  row:      { display:"flex", alignItems:"center", gap:8 },
  g2:       { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:13 },
  g3:       { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 },
  // nav
  nav:      { background:C.white, borderBottom:`2px solid ${C.blueLt}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, flexWrap:"wrap", gap:8 },
  logo:     { fontSize:"1.2rem", fontWeight:700, color:C.blue, cursor:"pointer" },
  navA:     { color:C.gray500, fontWeight:600, fontSize:".85rem", textDecoration:"none", cursor:"pointer" },
  // buttons
  btn:      { border:"none", padding:"9px 18px", borderRadius:6, fontFamily:"inherit", fontWeight:600, fontSize:".88rem", cursor:"pointer" },
  btnBlue:  { background:C.blue,   color:C.white },
  btnOut:   { background:C.white,  color:C.blue, border:`1.5px solid ${C.blue}` },
  btnRed:   { background:C.red,    color:C.white },
  btnGreen: { background:C.green,  color:C.white },
  btnAmber: { background:C.amber,  color:C.white },
  btnGray:  { background:C.gray200,color:C.gray700 },
  btnSm:    { padding:"5px 11px", fontSize:".78rem" },
  btnFull:  { width:"100%", padding:11 },
  // forms
  lbl:      { display:"block", fontSize:".78rem", fontWeight:700, color:C.gray700, marginBottom:4, textTransform:"uppercase", letterSpacing:".03em" },
  inp:      { width:"100%", padding:"9px 11px", border:`1.5px solid ${C.gray200}`, borderRadius:6, fontFamily:"inherit", fontSize:".9rem", color:C.gray900, background:C.white, outline:"none", boxSizing:"border-box" },
  fg:       { marginBottom:13 },
  // cards / sections
  card:     { background:C.white, border:`1px solid ${C.gray200}`, borderRadius:10, padding:20 },
  section:  { maxWidth:1020, margin:"0 auto", padding:"24px 16px" },
  secTitle: { fontSize:"1.2rem", fontWeight:700, marginBottom:4 },
  secSub:   { color:C.gray500, fontSize:".86rem", marginBottom:18 },
  // badges
  bdgGreen: { background:"#dcfce7", color:C.green,  display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:".7rem", fontWeight:700 },
  bdgRed:   { background:"#fee2e2", color:C.red,    display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:".7rem", fontWeight:700 },
  bdgBlue:  { background:C.blueLt,  color:C.blue,   display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:".7rem", fontWeight:700 },
  bdgAmber: { background:"#fef3c7", color:C.amber,  display:"inline-block", padding:"2px 9px", borderRadius:20, fontSize:".7rem", fontWeight:700 },
  // dashboard
  dashHdr:  { padding:"16px 20px", color:C.white },
  dashWrap: { width:"100%", maxWidth:"100%", padding:"18px 16px", display:"grid", gridTemplateColumns:"190px 1fr", gap:14, boxSizing:"border-box" },
  sideCard: { background:C.white, border:`1px solid ${C.gray200}`, borderRadius:10, overflow:"hidden" },
  sideItem: { padding:"10px 13px", cursor:"pointer", fontWeight:600, fontSize:".84rem", display:"flex", alignItems:"center", gap:7 },
  // info/warn boxes
  infoBox:  { background:C.blueLt, borderRadius:6, padding:"8px 11px", marginTop:11, fontSize:".78rem", color:C.blue },
  warnBox:  { background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:6, padding:"9px 12px", marginBottom:13, fontSize:".78rem", color:"#92400e" },
  // table
  th:       { textAlign:"left", padding:"9px 11px", background:C.blueLt, fontSize:".74rem", fontWeight:700, color:C.blue, textTransform:"uppercase" },
  td:       { padding:"9px 11px", borderBottom:`1px solid ${C.gray100}`, fontSize:".83rem", verticalAlign:"middle" },
};

export default s;
