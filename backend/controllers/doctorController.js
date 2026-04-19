const mongoose    = require("mongoose");
const Doctor      = require("../models/Doctor");
const Specialty   = require("../models/Specialty");
const Appointment = require("../models/Appointment");
const { issueVerificationToken } = require("./authController");

// Clinic: Add doctor
exports.addDoctor = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, password, degree, specialty, expertise, regNo, college, exp, fee, bio, photoUrl, morningSlots, afternoonSlots, eveningSlots, nightSlots, slotDuration, morningStartTime, morningEndTime, afternoonStartTime, afternoonEndTime, eveningStartTime, eveningEndTime, nightStartTime, nightEndTime, morningActive, afternoonActive, eveningActive, nightActive, tomorrowBookingCutoffTime, bookingCutoffDay, slotBookingOffset, available, unavailableUntil } = req.body;
    if (!firstName || !lastName || !email || !password || !degree || !specialty || !regNo || !exp)
      return res.status(400).json({ error: "Please fill all required fields (Name, Email, Password, Degree, Specialty, RegNo, Experience)." });

    // Ensure clinic is the one adding
    if (req.role !== "clinic") return res.status(403).json({ error: "Only clinics can add doctors" });

    const doctor = await Doctor.create({
      clinicId: req.user._id,
      firstName, lastName, email, phone, gender, password, degree, specialty, expertise: expertise || "", regNo, college, exp, fee: parseInt(fee) || 500, bio, photoUrl: photoUrl || "",
      morningSlots: parseInt(morningSlots) || 0,
      afternoonSlots: parseInt(afternoonSlots) || 0,
      eveningSlots: parseInt(eveningSlots) || 0,
      nightSlots: parseInt(nightSlots) || 0,
      slotDuration: parseInt(slotDuration) || 30,
      morningStartTime: morningStartTime || "08:00 AM",
      morningEndTime: morningEndTime || "12:00 PM",
      afternoonStartTime: afternoonStartTime || "12:00 PM",
      afternoonEndTime: afternoonEndTime || "04:00 PM",
      eveningStartTime: eveningStartTime || "04:00 PM",
      eveningEndTime: eveningEndTime || "08:00 PM",
      nightStartTime: nightStartTime || "08:00 PM",
      nightEndTime: nightEndTime || "11:59 PM",
      morningActive: morningActive !== undefined ? morningActive : true,
      afternoonActive: afternoonActive !== undefined ? afternoonActive : true,
      eveningActive: eveningActive !== undefined ? eveningActive : true,
      nightActive: nightActive !== undefined ? nightActive : true,
      tomorrowBookingCutoffTime: tomorrowBookingCutoffTime || "",
      bookingCutoffDay: bookingCutoffDay || "previous_day",
      slotBookingOffset: slotBookingOffset || "",
      available: available !== false,
      unavailableUntil: unavailableUntil || null,
      isEmailVerified: false,
    });

    // Issue verification token with throttle protection
    await issueVerificationToken(email.toLowerCase(), "doctor", `Dr. ${firstName} ${lastName}`);

    res.status(201).json({ message: "Doctor added. Verification email sent.", doctor });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Clinic: Get own doctors
exports.getClinicDoctors = async (req, res) => {
  try {
    const clinicId = req.role === "clinic" ? req.user._id : req.params.clinicId;
    if (!clinicId) return res.status(400).json({ error: "Clinic ID required" });
    const doctors = await Doctor.find({ clinicId });
    res.json(doctors);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Public/Targeted: Get doctors by clinic and specialty
exports.getDoctorsByClinicAndSpecialty = async (req, res) => {
  try {
    const { clinicId, specialty } = req.params;
    const today = new Date().toISOString().split("T")[0];
    
    // Get doctors
    const doctors = await Doctor.find({ clinicId, specialty }).lean();
    
    // Validate clinicId for aggregation
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ error: "Invalid Clinic ID" });
    }
    
    // Get booked counts for each doctor for today
    const counts = await Appointment.aggregate([
      { $match: { 
          clinicId: new mongoose.Types.ObjectId(clinicId), 
          date: today, 
          status: { $in: ["pending", "approved"] } 
      } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } }
    ]);
    
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });
    
    const enriched = doctors.map(d => ({
      ...d,
      bookedToday: countMap[d._id.toString()] || 0
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Clinic: Update Doctor
exports.updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.id, clinicId: req.user._id });
    if (!doctor) return res.status(404).json({ error: "Doctor not found or not authorized" });

    const allowed = ["firstName", "lastName", "email", "phone", "gender", "password", "degree", "specialty", "expertise", "college", "exp", "fee", "bio", "photoUrl", "available", "unavailableUntil", "morningSlots", "afternoonSlots", "eveningSlots", "nightSlots", "slotDuration", "morningStartTime", "morningEndTime", "afternoonStartTime", "afternoonEndTime", "eveningStartTime", "eveningEndTime", "nightStartTime", "nightEndTime", "morningActive", "afternoonActive", "eveningActive", "nightActive", "tomorrowBookingCutoffTime", "bookingCutoffDay", "slotBookingOffset"];
    const oldEmail = doctor.email;
    allowed.forEach(f => {
      if (req.body[f] !== undefined && req.body[f] !== "") {
        if (f === "unavailableUntil" && req.body[f] === "") doctor[f] = null;
        else doctor[f] = req.body[f];
      }
    });

    const isEmailChanged = req.body.email && req.body.email.toLowerCase() !== oldEmail.toLowerCase();
    if (isEmailChanged) {
      doctor.isEmailVerified = false;
      await issueVerificationToken(req.body.email.toLowerCase(), "doctor", `Dr. ${doctor.firstName} ${doctor.lastName}`);
    }

    await doctor.save();
    
    res.json({ message: isEmailChanged ? "Doctor updated. New verification email sent." : "Doctor updated", doctor });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Clinic: Delete Doctor
exports.deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOneAndDelete({ _id: req.params.id, clinicId: req.user._id });
    if (!doctor) return res.status(404).json({ error: "Doctor not found or not authorized" });
    res.json({ message: "Doctor removed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Get all doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({}).populate("clinicId", "name");
    res.json(doctors);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
