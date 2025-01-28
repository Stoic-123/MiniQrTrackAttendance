const express = require("express");
const router = express.Router();
const { signUpPost, loginPost, logout } = require("../controllers/auth");
router.post("/auth/signup", signUpPost);
router.post("/auth/login", loginPost);
router.delete("/auth/logout", logout);
module.exports = router;
