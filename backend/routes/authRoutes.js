const express = require("express");
const { login, refreshSession, logout } = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refreshSession);
router.post("/logout", logout);

module.exports = router;
