const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const ctrl    = require("../controllers/uploadController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

router.post("/doctor-photo", upload.single("photo"), ctrl.uploadDoctorPhoto);
router.get("/test",          ctrl.testCloudinary);

module.exports = router;
