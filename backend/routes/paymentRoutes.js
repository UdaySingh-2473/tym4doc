const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/auth");

router.post("/create-order", protect, authorize("patient"), ctrl.createOrder);
router.post("/verify",       protect, authorize("patient"), ctrl.verify);
router.post("/refund",       protect,                       ctrl.refund);
router.get("/key",           protect,                       ctrl.getKey);

module.exports = router;
