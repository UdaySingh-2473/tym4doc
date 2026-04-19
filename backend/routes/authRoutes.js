const express = require("express");
const router  = express.Router();
const {
  patientRegister, patientLogin,
  clinicRegister,  clinicLogin,
  doctorLogin,
  adminLogin,
  forgotPassword, resetPassword, changePassword,
  verifyEmail, resendVerification,
  updatePatientProfile, updateClinicProfile,
  getPatientProfile, getClinicProfile, getDoctorProfile,
  getAdminPatients
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");

// Public auth
router.post("/patient/register", patientRegister);
router.post("/patient/login",    patientLogin);
router.post("/clinic/register",  clinicRegister);
router.post("/clinic/login",     clinicLogin);
router.post("/doctor/login",     doctorLogin);
router.post("/admin/login",      adminLogin);

// Forgot / Reset password (public — no token needed)
router.post("/forgot-password",  forgotPassword);
router.post("/reset-password",   resetPassword);
router.get("/verify-email",     verifyEmail);

// Change password (authenticated)
router.put("/change-password", protect, authorize("patient", "clinic", "doctor"), changePassword);
router.post("/resend-verification", protect, authorize("patient", "clinic", "doctor"), resendVerification);

// Profile (authenticated)
router.get("/patient/profile", protect, authorize("patient"), getPatientProfile);
router.put("/patient/profile", protect, authorize("patient"), updatePatientProfile);
router.get("/clinic/profile",  protect, authorize("clinic"),  getClinicProfile);
router.put("/clinic/profile",  protect, authorize("clinic"),  updateClinicProfile);
router.get("/doctor/profile",  protect, authorize("doctor"),  getDoctorProfile);

// Admin Only
router.get("/admin/patients", protect, authorize("admin"), getAdminPatients);

module.exports = router;
