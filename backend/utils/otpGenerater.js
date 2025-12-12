const crypto = require("crypto");

const otpGenerate = () => {
  const buffer = crypto.randomBytes(3); // 3 bytes = 24 bits ≈ range up to 16,777,215
  const otp = (parseInt(buffer.toString("hex"), 16) % 1000000).toString().padStart(6, "0");
  return otp;
};

module.exports = otpGenerate;