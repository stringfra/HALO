const express = require("express");
const {
  signup,
  login,
  refreshSession,
  logout,
  listSignupBusinessTypes,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.get("/signup/business-types", listSignupBusinessTypes);
router.post("/login", login);
router.post("/refresh", refreshSession);
router.post("/logout", logout);

module.exports = router;
