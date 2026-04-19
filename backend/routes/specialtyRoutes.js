const express = require("express");
const router  = express.Router();
const { addSpecialty, getAllSpecialties } = require("../controllers/specialtyController");
const { protect, authorize } = require("../middleware/auth");

router.get("/", getAllSpecialties);
router.post("/", protect, authorize("admin"), addSpecialty);

module.exports = router;
