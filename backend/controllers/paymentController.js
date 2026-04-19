const crypto      = require("crypto");
const Appointment = require("../models/Appointment");

let razorpay;
function getRazorpay() {
  if (!razorpay) {
    const Razorpay = require("razorpay");
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt = `rcpt_${Date.now()}` } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount is required" });
    const order = await getRazorpay().orders.create({ amount: Math.round(amount * 100), currency, receipt, payment_capture: 1 });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Razorpay create-order error:", err.message);
    res.status(500).json({ error: "Could not create payment order. Check Razorpay credentials." });
  }
};

exports.verify = (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ error: "Missing payment fields" });
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature)
      return res.status(400).json({ error: "Payment verification failed — invalid signature" });
    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.refund = async (req, res) => {
  try {
    const { appointmentId, reason = "Appointment cancelled" } = req.body;
    if (!appointmentId) return res.status(400).json({ error: "appointmentId is required" });

    const appt = await Appointment.findById(appointmentId);
    if (!appt)                                  return res.status(404).json({ error: "Appointment not found" });
    if (appt.payment?.status !== "paid")        return res.status(400).json({ error: "No paid payment found" });
    if (appt.payment?.status === "refunded")    return res.status(400).json({ error: "Payment already refunded" });
    if (!appt.payment?.paymentId)               return res.status(400).json({ error: "No Razorpay payment ID found" });

    const refund = await getRazorpay().payments.refund(appt.payment.paymentId, {
      amount: appt.payment.amount,
      notes: { reason, appointmentId: String(appointmentId) },
      speed: "normal",
    });

    appt.payment.status       = "refunded";
    appt.payment.refundId     = refund.id;
    appt.payment.refundAmount = refund.amount;
    appt.payment.refundedAt   = new Date();
    appt.payment.refundReason = reason;
    await appt.save();

    res.json({ success: true, refundId: refund.id, amount: refund.amount, status: refund.status, message: "Refund initiated. Amount will be credited in 5-7 business days." });
  } catch (err) {
    console.error("Refund error:", err.message);
    res.status(500).json({ error: err.message || "Refund failed" });
  }
};

exports.getKey = (req, res) => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID });
};

exports.testConnection = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      return res.status(500).json({ ok: false, error: "Razorpay env vars missing" });
    await getRazorpay().orders.all({ count: 1 });
    res.json({ ok: true, message: "Razorpay connected!" });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
};
