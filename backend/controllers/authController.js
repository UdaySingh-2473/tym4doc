const bcrypt        = require("bcryptjs");
const crypto        = require("crypto");
const Patient       = require("../models/Patient");
const Clinic        = require("../models/Clinic");
const Doctor        = require("../models/Doctor");
const AuthToken     = require("../models/AuthToken");
const { generateToken } = require("../middleware/auth");
const { sendPasswordResetLink, sendVerificationEmailLink } = require("../services/emailService");
const { generateRandomHexToken } = require("../utils/tokenGenerator");

// Patient: Register
exports.patientRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: "Please fill all required fields" });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    if (await Patient.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: "Email already registered. Please sign in." });

    const patient = await Patient.create({ firstName, lastName, email, phone, password });
    
    // Issue verification token with throttle protection
    await exports.issueVerificationToken(email, "patient", `${firstName} ${lastName}`);

    const authToken = generateToken(patient._id, "patient");
    res.status(201).json({
      token: authToken,
      user: { id: patient._id, name: `${patient.firstName} ${patient.lastName}`, email: patient.email, role: "patient", isEmailVerified: false },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Patient: Login
exports.patientLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Please enter email and password" });

    const patient = await Patient.findOne({ email: email.toLowerCase() }).select("+password");
    if (!patient) return res.status(401).json({ error: "No account found. Please register first." });

    const isMatch = await patient.matchPassword(password);

    if (!isMatch)
      return res.status(401).json({ error: "Incorrect password" });

    const token = generateToken(patient._id, "patient");
    res.json({
      token,
      user: { id: patient._id, name: `${patient.firstName} ${patient.lastName}`, email: patient.email, role: "patient", isEmailVerified: patient.isEmailVerified },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Clinic: Register
exports.clinicRegister = async (req, res) => {
  try {
    const { name, email, phone, password, address, city, state, location, description, documents } = req.body;

    if (!name || !email || !password || !address || !city || !state)
      return res.status(400).json({ error: "Please fill all required fields" });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    if (await Clinic.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: "Email already registered" });

    const clinic = await Clinic.create({
      name, email, phone, password, address, city, state, location, description, documents
    });
    
    // Issue verification token with throttle protection
    await exports.issueVerificationToken(email, "clinic", name);

    const authToken = generateToken(clinic._id, "clinic");
    res.status(201).json({
      token: authToken,
      user: { id: clinic._id, name: clinic.name, email: clinic.email, role: "clinic", status: clinic.status, isEmailVerified: false },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Clinic: Login
exports.clinicLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Please enter email and password" });

    const clinic = await Clinic.findOne({ email: email.toLowerCase() }).select("+password");
    if (!clinic) return res.status(401).json({ error: "Email not found. Please register first." });

    const isMatch = await clinic.matchPassword(password);

    if (!isMatch)
      return res.status(401).json({ error: "Incorrect password" });

    const token = generateToken(clinic._id, "clinic");
    res.json({
      token,
      user: {
        id: clinic._id, name: clinic.name,
        email: clinic.email, role: "clinic", status: clinic.status,
        isEmailVerified: clinic.isEmailVerified,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Doctor: Login
exports.doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Please enter email and password" });

    const doctor = await Doctor.findOne({ email: email.toLowerCase() }).select("+password");
    if (!doctor) return res.status(401).json({ error: "Doctor account not found." });

    const isMatch = await doctor.matchPassword(password);

    if (!isMatch)
      return res.status(401).json({ error: "Incorrect password" });

    const token = generateToken(doctor._id, "doctor");
    res.json({
      token,
      user: {
        id: doctor._id, 
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        email: doctor.email, 
        role: "doctor",
        clinicId: doctor.clinicId,
        isEmailVerified: doctor.isEmailVerified
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Resend Verification (Authenticated)
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.user;
    const role = req.role;
    
    if (!email || !role) return res.status(400).json({ error: "Could not identify user email or role." });

    const name = role === "clinic" ? req.user.name : role === "doctor" ? `Dr. ${req.user.firstName} ${req.user.lastName}` : `${req.user.firstName} ${req.user.lastName}`;
    
    await exports.issueVerificationToken(email, role, name);

    res.json({ message: "A verification link has been sent to " + email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: Login
exports.adminLogin = (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass  = process.env.ADMIN_PASSWORD;


  
  if (
    email?.trim().toLowerCase() === adminEmail?.trim().toLowerCase() && 
    password?.trim() === adminPass?.trim()
  ) {
    const token = generateToken("admin", "admin");
    return res.json({ token, user: { name: "Admin", email: adminEmail, role: "admin" } });
  }
  

  res.status(401).json({ error: "Invalid admin credentials" });
};

// Issue verification link (30s throttle to prevent duplicate emails)
exports.issueVerificationToken = async (email, role, name) => {
  const existing = await AuthToken.findOne({ email: email.toLowerCase(), purpose: "verify" });
  
  if (existing && existing.createdAt && (Date.now() - existing.createdAt < 30000)) {
    return existing;
  }

  const tokenStr = generateRandomHexToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  const token = await AuthToken.findOneAndUpdate(
    { email: email.toLowerCase(), purpose: "verify" },
    { token: tokenStr, role, expiresAt, createdAt: new Date() },
    { upsert: true, new: true }
  );

  await sendVerificationEmailLink(email.toLowerCase(), tokenStr, role, name);
  return token;
};

// Forgot Password

exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ error: "Email and role are required" });

    const Model = role === "clinic" ? Clinic : role === "doctor" ? Doctor : Patient;
    const user = await Model.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "No account found with this email" });

    const token = generateRandomHexToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await AuthToken.findOneAndUpdate(
      { email: email.toLowerCase(), purpose: "reset" },
      { token, role, expiresAt, verified: false },
      { upsert: true, new: true }
    );

    const name = role === "clinic" ? user.name : role === "doctor" ? `Dr. ${user.firstName} ${user.lastName}` : `${user.firstName} ${user.lastName}`;
    
    await sendPasswordResetLink(email, token, role, name);

    res.json({ message: "Password reset link sent to " + email });
  } catch (err) {
    console.error("Forgot password ERROR:", err);
    res.status(500).json({ error: `Reset failed: ${err.message}` });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, role } = req.body;
    if (!token || !newPassword || !role)
      return res.status(400).json({ error: "Token, role, and new password are required" });
    if (newPassword.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const record = await AuthToken.findOne({ token, role, purpose: "reset" });
    if (!record) return res.status(400).json({ error: "Invalid or expired reset token. Please request a new link." });
    if (record.expiresAt < new Date()) return res.status(400).json({ error: "Reset link has expired. Please request a new one." });

    const Model = role === "clinic" ? Clinic : role === "doctor" ? Doctor : Patient;
    const user = await Model.findOne({ email: record.email }).select("+password");
    if (!user) return res.status(404).json({ error: "Account not found" });


    user.password = newPassword;
    await user.save();
    
    await AuthToken.deleteOne({ _id: record._id });

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    let { token, role } = req.query;
    token = token?.trim();
    role = role?.trim();
    

    
    if (!token || !role) return res.status(400).json({ error: "Token and role are required" });

    const record = await AuthToken.findOne({ token, role, purpose: "verify" });
    
    if (!record) {
      return res.status(400).json({ error: "Verification link not found. It may have been used or expired." });
    }

    if (record.expiresAt < new Date()) {
      await AuthToken.deleteOne({ _id: record._id });
      return res.status(400).json({ error: "Verification link has expired (10 min limit). Please request a new one." });
    }

    const Model = role === "clinic" ? Clinic : role === "doctor" ? Doctor : Patient;
    const user = await Model.findOneAndUpdate({ email: record.email }, { isEmailVerified: true }, { new: true });
    
    if (!user) return res.status(400).json({ error: "Associated user account not found." });

    await AuthToken.deleteOne({ _id: record._id });

    res.json({ message: "Email verified successfully! You can now use all features." });
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Change Password (Authenticated)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Current and new passwords are required" });
    if (newPassword.length < 8)
      return res.status(400).json({ error: "New password must be at least 8 characters" });

    const Model = req.role === "clinic" ? Clinic : req.role === "doctor" ? Doctor : Patient;
    const user = await Model.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ error: "Current password is incorrect" });


    user.password = newPassword;
    await user.save();
    
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Patient Profile
exports.updatePatientProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (phone) {
      if (!/^\d{10}$/.test(phone))
        return res.status(400).json({ error: "Phone must be 10 digits" });
      updates.phone = phone;
    }
    const { email } = req.body;
    if (email && email.toLowerCase() !== req.user.email) {
      if (await Patient.findOne({ email: email.toLowerCase() })) {
        return res.status(400).json({ error: "Email already in use" });
      }
      updates.email = email.toLowerCase();
      updates.isEmailVerified = false;
      await exports.issueVerificationToken(email.toLowerCase(), "patient", `${req.user.firstName} ${req.user.lastName}`);
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: "No fields to update" });

    const patient = await Patient.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    res.json({
      message: email && email.toLowerCase() !== req.user.email ? "Profile updated. Please verify your new email." : "Profile updated successfully",
      user: { id: patient._id, firstName: patient.firstName, lastName: patient.lastName, email: patient.email, phone: patient.phone, isEmailVerified: patient.isEmailVerified },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Clinic Profile
exports.updateClinicProfile = async (req, res) => {
  try {
    const { name, phone, address, city, state, description, location, maxBookingDays } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) {
      if (!/^\d{10}$/.test(phone))
        return res.status(400).json({ error: "Phone must be 10 digits" });
      updates.phone = phone;
    }
    const { email } = req.body;
    if (email && email.toLowerCase() !== req.user.email) {
      if (await Clinic.findOne({ email: email.toLowerCase() })) {
        return res.status(400).json({ error: "Email already in use" });
      }
      updates.email = email.toLowerCase();
      updates.isEmailVerified = false;
      await exports.issueVerificationToken(email.toLowerCase(), "clinic", req.user.name);
    }
    if (address) updates.address = address;
    if (city) updates.city = city;
    if (state) updates.state = state;
    if (description !== undefined) updates.description = description;
    if (location) updates.location = location;
    if (maxBookingDays !== undefined) {
      if (Number(maxBookingDays) < 1) return res.status(400).json({ error: "Maximum Booking Days must be at least 1" });
      updates.maxBookingDays = Number(maxBookingDays);
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: "No fields to update" });

    const clinic = await Clinic.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });

    res.json({
      message: "Profile updated successfully",
      user: { id: clinic._id, name: clinic.name, email: clinic.email, phone: clinic.phone, address: clinic.address, city: clinic.city, state: clinic.state, description: clinic.description, role: "clinic", status: clinic.status },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Patient Profile
exports.getPatientProfile = async (req, res) => {
  try {
    const patient = await Patient.findById(req.user._id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    res.json({ id: patient._id, firstName: patient.firstName, lastName: patient.lastName, email: patient.email, phone: patient.phone, isEmailVerified: patient.isEmailVerified });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get Clinic Profile
exports.getClinicProfile = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.user._id);
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    res.json({ id: clinic._id, name: clinic.name, email: clinic.email, phone: clinic.phone, address: clinic.address, city: clinic.city, state: clinic.state, description: clinic.description, status: clinic.status, maxBookingDays: clinic.maxBookingDays, isEmailVerified: clinic.isEmailVerified });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get Doctor Profile
exports.getDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id).populate("clinicId", "name city address");
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json(doctor);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: Get All Patients
exports.getAdminPatients = async (req, res) => {
  try {
    const Appointment = require("../models/Appointment"); // lazy-loaded to avoid circular deps
    const patients = await Patient.find({}).select("-password").lean();
    
    // For each patient, find most recent booking to get a phone number fallback
    const enhanced = await Promise.all(patients.map(async (p) => {
      if (p.phone) return { ...p, lastUsedPhone: p.phone };
      const lastAppt = await Appointment.findOne({ patientId: p._id }).sort({ createdAt: -1 });
      return { ...p, lastUsedPhone: lastAppt ? lastAppt.patientPhone : null };
    }));

    res.json(enhanced);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
