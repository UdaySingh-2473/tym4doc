import { useState } from "react";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "mov30444@gmail.com";
const ADMIN_PASS  = import.meta.env.VITE_ADMIN_PASS  || "admin1234";
import s from "../../constants/styles";
import C from "../../constants/colors";
import { Btn, Inp } from "./UI";

export default function AdminModal({ open, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");

  if (!open) return null;

  function submit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (cleanEmail === ADMIN_EMAIL.trim().toLowerCase() && cleanPass === ADMIN_PASS.trim()) {
      setEmail(""); setPass(""); setErr("");
      onSuccess();
      onClose();
    } else {
      setErr("Invalid admin credentials.");
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ ...s.card, width:"100%", maxWidth:350, margin:16 }}>
        <h3 style={{ fontWeight:700, marginBottom:4 }}>Admin Login</h3>
        <p style={{ color:C.gray500, fontSize:".81rem", marginBottom:13 }}>Restricted access</p>

        <Inp label="Email"    type="email"    placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Inp label="Password" type="password" placeholder="password"          value={pass}  onChange={e => setPass(e.target.value)}  />

        {err && <p style={{ color:C.red, fontSize:".8rem", marginBottom:8 }}>{err}</p>}


        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn full onClick={submit}>Login</Btn>
          <Btn full color="gray" onClick={() => { onClose(); setErr(""); }}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
