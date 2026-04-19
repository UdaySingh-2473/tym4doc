const express = require("express");
const router  = express.Router();
const { addDoctor, getClinicDoctors, getDoctorsByClinicAndSpecialty, updateDoctor, deleteDoctor, getAllDoctors } = require("../controllers/doctorController");
const { protect, authorize } = require("../middleware/auth");

router.get("/all", protect, authorize("admin"), getAllDoctors);
router.post("/", protect, authorize("clinic"), addDoctor);
router.get("/my-doctors", protect, authorize("clinic"), getClinicDoctors);
router.get("/clinic/:clinicId", getClinicDoctors); // public
router.get("/clinic/:clinicId/specialty/:specialty", getDoctorsByClinicAndSpecialty);
router.put("/:id", protect, authorize("clinic"), updateDoctor);
router.delete("/:id", protect, authorize("clinic"), deleteDoctor);

module.exports = router;
