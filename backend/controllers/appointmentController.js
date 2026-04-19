const Appointment = require("../models/Appointment");
const Doctor      = require("../models/Doctor");
const Clinic      = require("../models/Clinic");
const emailService = require("../services/emailService");
const { formatSlotRange } = require("../utils/timeUtils");

// Get today's date as YYYY-MM-DD in local timezone
const getLocalDayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

exports.create = async (req, res) => {
  try {
    const { doctorId, date, time, reason, patientName, patientPhone, patientAge, patientAddress, patientGender, paymentOrderId, paymentId, paymentSignature, amount } = req.body;
    if (!doctorId || !date || !time)
      return res.status(400).json({ error: "doctorId, date, and time are required" });

    if (date < getLocalDayStr()) return res.status(400).json({ error: "Cannot book appointments in the past" });
    const doctor = await Doctor.findById(doctorId).populate("clinicId");
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    if (!doctor.available) return res.status(400).json({ error: "Doctor is not available for booking" });
    if (!doctor.clinicId || doctor.clinicId.status !== "approved")
      return res.status(400).json({ error: "Clinic is not approved" });

    const maxDays = doctor.clinicId.maxBookingDays || 7;
    const maxD = new Date(); maxD.setDate(maxD.getDate() + maxDays);
    if (date > getLocalDayStr(maxD)) return res.status(400).json({ error: `Bookings only allowed within the next ${maxDays} days` });

    const conflict = await Appointment.findOne({ doctorId, date, time, status: { $in: ["pending","approved"] } });
    if (conflict) {
      if (paymentId) {
        try {
          const Razorpay = require("razorpay");
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          await razorpay.payments.refund(paymentId, {
            notes: { reason: "Booking conflict - auto refund" },
            speed: "normal",
          });

        } catch (refundErr) {
          console.error("Critical: Failed to auto-refund conflicted booking:", refundErr.message);
        }
      }
      return res.status(400).json({ error: "This slot is already booked. If you paid, a refund has been initiated automatically." });
    }

    const clinic_earning = Number(doctor.fee);
    const admin_commission = Math.ceil(clinic_earning * 0.05);
    const total_fee = clinic_earning + admin_commission;
    const slotDuration = doctor.slotDuration || 30;
    const timeSlot = formatSlotRange(time, slotDuration);

    const appt = await Appointment.create({
      patientId:    req.user._id,
      patientName:  patientName || `${req.user.firstName} ${req.user.lastName}`,
      patientEmail: req.user.email,
      patientPhone: patientPhone || "0000000000",
      doctorId, 
      doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      clinicId: doctor.clinicId._id,
      date, time, reason, 
      timeSlot,
      slotDuration,
      patientAge, patientAddress, patientGender,
      status: "approved",
      total_fee, admin_commission, clinic_earning,
      payment: paymentId
        ? { status: "paid", orderId: paymentOrderId, paymentId, signature: paymentSignature, amount, paidAt: new Date() }
        : { status: "pending" },
    });
    res.status(201).json(appt);

    const io = require("../socket").getIO();
    if (io) {
      io.to(`clinic:${doctor.clinicId._id}`).emit("new-appointment", appt);
      io.to(`doctor:${doctorId}`).emit("new-appointment", appt);
      io.to(`doctor-slots:${doctorId}:${date}`).emit("slot-booked", { time });
      io.to("admin").emit("admin-activity", { type: "new-appointment", appt });
    }


    try {
      const emailParams = {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        specialty: doctor.specialty,
        date: appt.date,
        time: appt.timeSlot || appt.time
      };
      if (appt.status === "approved") {
        await emailService.sendApprovalNotice(appt.patientEmail, emailParams);
      } else {
        await emailService.sendBookingConfirm(appt.patientEmail, emailParams);
      }
    } catch (emailErr) {
      console.error("Failed to send booking email:", emailErr.message);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date required" });
    const booked = await Appointment.find({ doctorId, date, status: { $in: ["pending","approved"] } }).select("time");
    res.json(booked.map(a => a.time));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getMine = async (req, res) => {
  try {
    const appts = await Appointment.find({ patientId: req.user._id })
      .populate("doctorId", "firstName lastName degree specialty photoUrl fee morningStartTime morningEndTime afternoonStartTime afternoonEndTime eveningStartTime eveningEndTime nightStartTime nightEndTime morningActive afternoonActive eveningActive nightActive slotDuration tomorrowBookingCutoffTime bookingCutoffDay slotBookingOffset")
      .populate("clinicId", "name address city maxBookingDays")
      .sort({ createdAt: -1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getClinicAppointments = async (req, res) => {
  try {
    const appts = await Appointment.find({ clinicId: req.user._id })
      .populate("patientId", "firstName lastName email phone")
      .populate("doctorId", "firstName lastName")
      .sort({ date: 1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDoctorAppointments = async (req, res) => {
  try {
    const appts = await Appointment.find({ doctorId: req.user._id })
      .populate("patientId", "firstName lastName email phone")
      .populate("clinicId", "name city address")
      .sort({ date: 1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const appts = await Appointment.find({})
      .populate("doctorId",  "firstName lastName")
      .populate("patientId", "firstName lastName email")
      .populate("clinicId", "name")
      .sort({ createdAt: -1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};


exports.reject = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const isClinic = req.role === "clinic" && String(appt.clinicId) === String(req.user._id);
    const isDoctor = req.role === "doctor" && String(appt.doctorId) === String(req.user._id);
    
    if (!isClinic && !isDoctor && req.role !== "admin")
      return res.status(403).json({ error: "Only the clinic, doctor or admin can reject appointments" });

    appt.status = "cancelled";
    appt.cancelledBy = req.role;
    if (req.body.rescheduleSuggest) {
       appt.rescheduleSuggest = typeof req.body.rescheduleSuggest === 'object' ? req.body.rescheduleSuggest.date : req.body.rescheduleSuggest;
    }
    await appt.save();
    res.json({ message: "Appointment rejected", appt });

    const io = require("../socket").getIO();
    if (io) {
      const rooms = [`patient:${appt.patientId}`, `clinic:${appt.clinicId}`, `doctor:${appt.doctorId}`];
      rooms.forEach(room => io.to(room).emit("appointment-updated", { _id: appt._id, status: appt.status }));
      io.to("admin").emit("admin-activity", { type: "appointment-rejected", appt });
    }

    try {
      await emailService.sendCancellationNotice(appt.patientEmail, {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        date: appt.date,
        time: appt.timeSlot || appt.time,
        rescheduleSuggest: appt.rescheduleSuggest,
        refundInitiated: appt.payment?.status === "paid"
      });
    } catch (emailErr) {
      console.error("Failed to send rejection email:", emailErr.message);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.cancel = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    const isPatient = req.role === "patient" && appt.patientId.toString() === req.user._id.toString();
    const isClinic  = req.role === "clinic"  && appt.clinicId.toString()  === req.user._id.toString();
    if (!isPatient && !isClinic && req.role !== "admin")
      return res.status(403).json({ error: "Not authorised to cancel this appointment" });
    appt.status = "cancelled";
    appt.cancelledBy = req.role;
    if (req.body.rescheduleSuggest) appt.rescheduleSuggest = req.body.rescheduleSuggest;
    await appt.save();
    res.json({ message: "Appointment cancelled", appt });

    const io = require("../socket").getIO();
    if (io) {
      const rooms = [`patient:${appt.patientId}`, `clinic:${appt.clinicId}`, `doctor:${appt.doctorId}`];
      rooms.forEach(room => io.to(room).emit("appointment-updated", { _id: appt._id, status: appt.status }));
      io.to(`doctor-slots:${appt.doctorId}:${appt.date}`).emit("slot-freed", { time: appt.time });
      io.to("admin").emit("admin-activity", { type: "appointment-cancelled", appt });
    }


    try {
      await emailService.sendCancellationNotice(appt.patientEmail, {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        date: appt.date,
        time: appt.timeSlot || appt.time,
        rescheduleSuggest: appt.rescheduleSuggest,
        refundInitiated: appt.payment?.status === "paid"
      });
    } catch (emailErr) {
      console.error("Failed to send cancellation email:", emailErr.message);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.complete = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate("doctorId", "clinicId");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const isClinic = req.role === "clinic" && appt.clinicId.toString() === req.user._id.toString();
    const isDoctor = req.role === "doctor" && appt.doctorId._id.toString() === req.user._id.toString();

    if (!isClinic && !isDoctor) return res.status(403).json({ error: "Not authorised" });
    appt.status = "completed";
    await appt.save();
    res.json({ message: "Appointment marked as completed", appt });

    const io = require("../socket").getIO();
    if (io) {
      io.to(`patient:${appt.patientId}`).emit("appointment-updated", { _id: appt._id, status: appt.status });
      io.to(`clinic:${appt.clinicId}`).emit("appointment-updated", { _id: appt._id, status: appt.status });
      io.to(`doctor:${appt.doctorId._id}`).emit("appointment-updated", { _id: appt._id, status: appt.status });
      io.to("admin").emit("admin-activity", { type: "appointment-completed", appt });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getCommissionStats = async (req, res) => {
  try {
    const appts = await Appointment.find({ status: { $in: ["completed", "approved"] }, settled: { $ne: true } });
    const totalAdminCommission = appts.reduce((sum, a) => sum + (a.admin_commission || 0), 0);

    const [totalDocs, totalPats] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments()
    ]);

    const result = {
      totalAppointments: appts.length,
      totalCommission: totalAdminCommission,
      totalDoctors: totalDocs,
      totalPatients: totalPats
    };
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Get specific patient's appointment history
exports.getAdminPatientHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const appts = await Appointment.find({ patientId: id })
      .populate("doctorId", "firstName lastName specialty degree photoUrl fee morningStartTime morningEndTime afternoonStartTime afternoonEndTime eveningStartTime eveningEndTime nightStartTime nightEndTime morningActive afternoonActive eveningActive nightActive slotDuration tomorrowBookingCutoffTime bookingCutoffDay slotBookingOffset")
      .populate("clinicId", "name address city maxBookingDays")
      .sort({ date: -1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Get specific doctor's appointment history (patients seen)
exports.getAdminDoctorHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const appts = await Appointment.find({ doctorId: id })
      .populate("patientId", "firstName lastName email phone")
      .populate("clinicId", "name city")
      .sort({ date: -1 });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.reschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newTime, patientAge, patientAddress, patientGender, paymentOrderId, paymentId, paymentSignature, amount } = req.body;
    
    if (!newDate || !newTime) return res.status(400).json({ error: "New date and time are required" });

    const appt = await Appointment.findById(id).populate("clinicId");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (patientAge) appt.patientAge = patientAge;
    if (patientAddress) appt.patientAddress = patientAddress;
    if (patientGender) appt.patientGender = patientGender;

    if (appt.patientId.toString() !== req.user._id.toString() && req.role !== "admin")
      return res.status(403).json({ error: "Not authorised to reschedule this appointment" });

    if (appt.status === "completed") return res.status(400).json({ error: "Cannot reschedule a completed appointment" });

    if (newDate < getLocalDayStr()) return res.status(400).json({ error: "Cannot reschedule to a past date" });

    const maxDays = appt.clinicId.maxBookingDays || 7;
    const maxD = new Date(); maxD.setDate(maxD.getDate() + maxDays);
    if (newDate > getLocalDayStr(maxD)) return res.status(400).json({ error: `Rescheduling only allowed within the next ${maxDays} days` });

    const conflict = await Appointment.findOne({ 
      doctorId: appt.doctorId, 
      date: newDate, 
      time: newTime, 
      status: { $in: ["pending","approved"] },
      _id: { $ne: id }
    });
    if (conflict) {
      if (paymentId) {
        try {
          const Razorpay = require("razorpay");
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          await razorpay.payments.refund(paymentId, {
            notes: { reason: "Reschedule conflict - auto refund" },
            speed: "normal",
          });

        } catch (refundErr) {
          console.error("Critical: Failed to auto-refund conflicted reschedule:", refundErr.message);
        }
      }
      return res.status(400).json({ error: "This slot is already booked. If you paid a reschedule fee, a refund has been initiated." });
    }

    const oldDate = appt.date;
    const oldTimeFormatted = appt.timeSlot || appt.time;
    
    appt.date = newDate;
    appt.time = newTime;
    appt.timeSlot = formatSlotRange(newTime, appt.slotDuration || 30);
    appt.status = "approved";

    appt.rescheduleHistory.push({
      oldDate, 
      oldTime: oldTimeFormatted, 
      newDate, 
      newTime: appt.timeSlot,
      feePaid: amount,
      paymentId, orderId: paymentOrderId, signature: paymentSignature,
      paidAt: new Date()
    });

    await appt.save();
    res.json({ message: "Appointment rescheduled successfully", appt });

    const io = require("../socket").getIO();
    if (io) {
      io.to(`clinic:${appt.clinicId._id}`).emit("appointment-updated", { _id: appt._id, status: appt.status, rescheduled: true });
      io.to(`doctor:${appt.doctorId}`).emit("appointment-updated", { _id: appt._id, status: appt.status, rescheduled: true });
      io.to(`doctor-slots:${appt.doctorId}:${oldDate}`).emit("slot-freed", { time: oldTimeFormatted.split(" ")[0] });
      io.to(`doctor-slots:${appt.doctorId}:${newDate}`).emit("slot-booked", { time: newTime });
      io.to("admin").emit("admin-activity", { type: "appointment-rescheduled", appt });
    }


    try {
      await emailService.sendRescheduleNotice(appt.patientEmail, {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        oldDate,
        oldTime: oldTimeFormatted,
        newDate,
        newTime: appt.timeSlot
      });
    } catch (emailErr) {
      console.error("Failed to send reschedule email:", emailErr.message);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remind = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    
    // Only clinic can remind
    if (req.role !== "clinic" || appt.clinicId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorised to send reminder for this appointment" });
    }

    const { msg } = req.body;
    if (!msg) return res.status(400).json({ error: "Message is required" });

    try {
      await emailService.sendAppointmentReminder(appt.patientEmail, {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        date: appt.date,
        time: appt.timeSlot || appt.time,
        msg
      });
      res.json({ message: "Reminder sent successfully" });
    } catch (emailErr) {
      console.error("Failed to send reminder email:", emailErr.message);
      res.status(500).json({ error: "Failed to send email reminder", details: emailErr.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
