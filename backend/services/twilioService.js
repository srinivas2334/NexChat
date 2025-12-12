const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken);

const sendOtpToPhoneNumber = async (phoneNumber) => {
  try {
    console.log("Sending OTP to this Number:", phoneNumber);
    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }
    const response = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
      });
    console.log("This is my OTP response:", response);
    return response;
  } catch (error) {
    console.error("Error sending OTP:", error);
  }
};

const verifyOtp = async (phoneNumber, otp) => {
  try {
    console.log("Verifying OTP for this Number:", phoneNumber);
    console.log("With this OTP:", otp);
    const response = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code: otp,
      });
    console.log("This is my OTP response:", response);
    return response;
  } catch (error) {
    console.error(error);
    throw new Error("OTP verification failed");
  }
};

module.exports = { sendOtpToPhoneNumber, verifyOtp };
