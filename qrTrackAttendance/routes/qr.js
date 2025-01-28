const express = require("express");
const router = express.Router();
const qrController = require("../controllers/qr");

router.get("/qr/generate", qrController.generateQR);
router.post("/qr/scan", qrController.scanQR);
router.get("/qr/latest", qrController.getLatestQR);
module.exports = router;
