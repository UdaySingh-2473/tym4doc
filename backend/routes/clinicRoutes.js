const express = require("express");
const router  = express.Router();
const {
  getAllClinics, approveClinic, rejectClinic, blockClinic,
  searchClinics, getSearchSuggestions, getClinicDetails, getAdminClinicStats,
  settleClinicAccounts
} = require("../controllers/clinicController");
const { protect, authorize } = require("../middleware/auth");

// Public
router.get("/search", searchClinics);
router.get("/suggestions", getSearchSuggestions);

// Admin (must come BEFORE /:id so "search" etc. aren't captured)
router.get("/", protect, authorize("admin"), getAllClinics);
router.get("/:id/stats", protect, authorize("admin"), getAdminClinicStats);
router.put("/:id/approve", protect, authorize("admin"), approveClinic);
router.put("/:id/reject", protect, authorize("admin"), rejectClinic);
router.put("/:id/block", protect, authorize("admin"), blockClinic);
router.post("/:id/settle", protect, authorize("admin"), settleClinicAccounts);

// Public detail (must be last — catches any :id)
router.get("/:id", getClinicDetails);

module.exports = router;
