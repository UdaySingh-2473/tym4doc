const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/appointmentController");
const { protect, authorize } = require("../middleware/auth");

router.get("/slots",         ctrl.getSlots);
router.post("/",             protect, authorize("patient"), ctrl.create);
router.get("/mine",          protect, authorize("patient"), ctrl.getMine);
router.get("/doctor",        protect, authorize("doctor"),  ctrl.getDoctorAppointments);
router.get("/clinic",        protect, authorize("clinic"),  ctrl.getClinicAppointments);
router.get("/all",           protect, authorize("admin"),   ctrl.getAll);
router.get("/commission",    protect, authorize("admin"),   ctrl.getCommissionStats);
router.get("/admin/patient/:id", protect, authorize("admin"), ctrl.getAdminPatientHistory);
router.get("/admin/doctor/:id",  protect, authorize("admin"), ctrl.getAdminDoctorHistory);
router.patch("/:id/reject",  protect, authorize("clinic", "doctor"),  ctrl.reject);
router.patch("/:id/cancel",  protect,                       ctrl.cancel);
router.patch("/:id/reschedule", protect, authorize("patient"), ctrl.reschedule);
router.patch("/:id/complete", protect, authorize("clinic", "doctor"), ctrl.complete);
router.post("/:id/remind", protect, authorize("clinic"), ctrl.remind);

module.exports = router;
