const express = require("express");
const {sendOtp,verifyOtp,logout} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { multerMiddleware } = require("../config/cloudinaryConfig");
const authController = require("../controllers/authController");


const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/logout", logout);

//protected route 
router.put("/update-profile",authMiddleware,multerMiddleware,authController.updateProfile);
router.get("/check-auth",authMiddleware,authController.checkAuthenticated);
router.get("/users",authMiddleware,authController.getAllUsers);

module.exports = router;