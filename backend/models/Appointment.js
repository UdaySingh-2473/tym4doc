const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    // Who
    patientId:   { type:mongoose.Schema.Types.ObjectId, ref:"Patient", required:true },
    patientName: { type:String, required:true },
    patientEmail:{ type:String, required:true },
    patientPhone: { type:String, required:true },
    patientAge:   { type:Number },
    patientAddress: { type:String },
    patientGender:  { type:String, enum:["Male", "Female", "Other"] },
    doctorId:    { type:mongoose.Schema.Types.ObjectId, ref:"Doctor",  required:true },
    doctorName:  { type:String },
    clinicId:    { type:mongoose.Schema.Types.ObjectId, ref:"Clinic",  required:true },

    // When
    date:        { type:String, required:true },
    time:        { type:String, required:true },
    timeSlot:    { type:String },                 // Full range e.g. "10:20 AM - 10:40 AM"
    slotDuration:{ type:Number, default:30 },
    reason:      { type:String },

    // Status
    status:            { type:String, enum:["pending","approved","cancelled","completed"], default:"pending" },
    cancelledBy:       { type:String },          // "patient" | "doctor" | "admin" | "clinic"
    rescheduleSuggest: { type:String },           // date string suggested by doctor on cancel

    total_fee:         { type:Number, required:true },
    admin_commission:  { type:Number, required:true },
    clinic_earning:    { type:Number, required:true },
    settled:           { type:Boolean, default:false },

    // Payment
    payment: {
      status:       { type:String, enum:["pending","paid","failed","refunded","partial_refund"], default:"pending" },
      orderId:      { type:String },   // Razorpay order_id
      paymentId:    { type:String },   // Razorpay payment_id (after success)
      signature:    { type:String },   // Razorpay signature
      amount:       { type:Number },   // in paise
      currency:     { type:String, default:"INR" },
      paidAt:       { type:Date },
      // Refund
      refundId:     { type:String },   // Razorpay refund_id
      refundAmount: { type:Number },   // in paise
      refundedAt:   { type:Date },
      refundReason: { type:String },
    },
    rescheduleHistory: [{
      oldDate:      { type:String },
      oldTime:      { type:String },
      newDate:      { type:String },
      newTime:      { type:String },
      feePaid:      { type:Number },   // in paise
      paymentId:    { type:String },
      orderId:      { type:String },
      signature:    { type:String },
      paidAt:       { type:Date }
    }]
  },
  { timestamps: true }
);

// Compound index so we can quickly find booked slots
appointmentSchema.index({ doctorId:1, date:1, time:1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
