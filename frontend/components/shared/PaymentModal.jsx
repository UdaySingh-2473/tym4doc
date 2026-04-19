import { useState } from "react";
import C from "../../constants/colors";
import s from "../../constants/styles";
import { Btn } from "./UI";
import { createRazorpayOrder, verifyPayment } from "../../services/api";

export default function PaymentModal({ open, onClose, onSuccess, onFail, doctor, token }) {
  const [loading, setLoading] = useState(false);

  if (!open || !doctor) return null;

  function loadRazorpayScript() {
    return new Promise(resolve => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload  = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePay() {
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { onFail("Failed to load Razorpay. Check your internet connection."); return; }

      const totalAmount = Math.ceil(Number(doctor.fee) * 1.05);
      const order = await createRazorpayOrder(
        { amount: totalAmount, currency: "INR", receipt: `rcpt_${Date.now()}` },
        token
      );

      const options = {
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        name:        "Tym4DOC",
        description: `Consultation with ${doctor.name}`,
        order_id:    order.orderId,
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }, token);
            onSuccess({
              orderId:   response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              amount:    order.amount,
            });
          } catch {
            onFail("Payment verification failed.");
          }
        },
        prefill:  { name: "", email: "", contact: "" },
        theme:    { color: "#1d4ed8" },
        modal:    { ondismiss: () => { setLoading(false); onClose(); } },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => { onFail("Payment failed. Please try again."); setLoading(false); });
      rzp.open();
    } catch (err) {
      onFail(err.message || "Payment error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:16, paddingBottom: 40 }}>
      <div style={{ ...s.card, maxWidth:380, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <h3 style={{ fontWeight:700, fontSize:"1.05rem", marginBottom:4 }}>Confirm Payment</h3>
        <p style={{ color:C.gray500, fontSize:".83rem", marginBottom:18 }}>Secure consultation fee payment</p>

        {/* Doctor info */}
        <div style={{ background:C.gray50, borderRadius:8, padding:"12px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:12 }}>
          {doctor.photoUrl ? (
            <img src={doctor.photoUrl} alt={doctor.name} style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2px solid #e2e8f0", flexShrink:0 }} />
          ) : (
            <div style={{ width:48, height:48, borderRadius:"50%", background:"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 800, color: "#1d4ed8", fontSize:"1.3rem", flexShrink:0 }}>P</div>
          )}
          <div>
            <div style={{ fontWeight:700, fontSize:".9rem" }}>{doctor.name}</div>
            <div style={{ fontSize:".78rem", color:C.gray500 }}>{doctor.spec} · {doctor.degree}</div>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:`1px solid ${C.gray100}`, marginBottom:18 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight:600, color:C.gray700, fontSize: ".85rem" }}>Consultation Fee: ₹{doctor.fee}</span>
            <span style={{ color:C.gray400, fontSize: ".7rem" }}>+ Platform Fee (5%): ₹{Math.ceil(Number(doctor.fee) * 0.05)}</span>
          </div>
          <span style={{ fontWeight:800, fontSize:"1.2rem", color:C.blue }}>₹{Math.ceil(Number(doctor.fee) * 1.05)}</span>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <Btn full disabled={loading} onClick={handlePay}
            style={{ background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", color:"#fff", fontWeight:700 }}>
            {loading ? "Opening…" : "Pay Rs." + Math.ceil(Number(doctor.fee) * 1.05)}
          </Btn>
          <Btn color="gray" onClick={onClose} disabled={loading}>Cancel</Btn>
        </div>
        <p style={{ textAlign:"center", fontSize:".72rem", color:C.gray400, marginTop:10 }}>
          Secured by Razorpay · UPI · Cards · Net Banking
        </p>
      </div>
    </div>
  );
}
