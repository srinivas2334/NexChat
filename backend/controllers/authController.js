const response = require("../utils/responseHandler");
const User = require("../models/User");
const otpGenerate = require("../utils/otpGenerater");
const sendOtpToEmail = require("../services/emailService");
const tiwlioService = require("../services/twilioService");
const generateToken = require("../utils/generateToken");
const Conversation = require("../models/Conversation");

//sendOtp
const sendOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email } = req.body;
  console.log(phoneNumber, phoneSuffix, email);
  const otp = otpGenerate();
 const expiry = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10 hours from now (testing purpose)
// const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  let user;
  try {
    if (email) {
      user = await User.findOne({ email: email });
      if (!user) {
        user = new User({ email: email });
      }
      user.emailOtp = otp;
      user.emailOtpExpiry = expiry;
      await user.save();
      await sendOtpToEmail(email, otp);
      return response(res, 200, "Otp send to your email", { email });
    }
    if (!phoneNumber || !phoneSuffix) {
      return response(res, 400, "Phone number and suffix are required");
    }
    const fullPhoneNumber = `+${phoneSuffix}${phoneNumber}`;
    user = await User.findOne({ phoneNumber });
    if (!user) {
      user = new User({ phoneNumber, phoneSuffix });
    }
    await tiwlioService.sendOtpToPhoneNumber(fullPhoneNumber);
    await user.save();
    return response(res, 200, "Otp send to your phone", { fullPhoneNumber });
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

//verify otp
const verifyOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email, otp } = req.body;

  try {
    let user;
    if (email) {
      user = await User.findOne({ email: email });
      if (!user) {
        return response(res, 404, "User not found");
      }
      const now = new Date();
      if (
        !user.emailOtp ||
        String(user.emailOtp) !== String(otp) ||
        now > new Date(user.emailOtpExpiry)
      ) {
        return response(res, 400, "Invalid or expired OTP");
      }
      user.isVerified = true;
      user.emailOtp = null;
      user.emailOtpExpiry = null;
      await user.save();
    } else {
      if (!phoneNumber || !phoneSuffix) {
        return response(res, 400, "Phone number and suffix are required");
      }
      const fullPhoneNumber = `+${phoneSuffix}${phoneNumber}`;
      user = await User.findOne({ phoneNumber });
      if (!user) {
        return response(res, 404, "User not found");
      }
      const result = await tiwlioService.verifyOtp(fullPhoneNumber, otp);
      if (result.status !== "approved") {
        return response(res, 400, "Invalid OTP");
      }
      user.isVerified = true;
      await user.save();
    }
    const token = generateToken(user._id);
    res.cookie("auth_token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "Lax",
      // secure: process.env.NODE_ENV === "production"
    });
    return response(res, 200, "OTP verified successfully", { token ,user });

  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

const updateProfile = async (req, res) => {
  // Implementation for updating user profile

  //   if (!req.user?.userId) {
  //   return response(res, 401, "Unauthorized: Please log in again");
  // }
  const {username,agreed,about} = req.body;
  const userId= req.user.userId;
  try {
    const user = await User.findById(userId);
    const file = req.file;
    if(file){
      const uploadResult = await uploadFileToCloudinary(file);
      console.log("Upload Result:", uploadResult);
      user.profilePicture = uploadResult?.secure_url;
    }else if(req.body.profilePicture){
      user.profilePicture = req.body.profilePicture;
    }

    if(username) user.username = username;
    if(about) user.about = about;
    if(agreed) user.agreed = agreed;

    await user.save();
    // console.log("Updated User:", user); 
    return response(res, 200, "UserProfile updated successfully", user );
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
}

const checkAuthenticated = async(req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return response(res, 401, "Unauthorized: Please log in again");
    }
    const user = await User.findById(userId);
    if (!user) {
      return response(res, 404, "User not found");
    }
    return response(res, 200, "User retrieved successfully. Allow to use NexChat", user);
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
}

const logout = async (req, res) => {
  try {
    res.cookie("auth_token","", {
      expires: new Date(0)
    });
    return response(res, 200, "Logged out successfully");
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
}

const getAllUsers = async (req, res) => {
  const loggedInUser = req.user.userId;
  try {
    const users = await User.find({_id: {$ne: loggedInUser}}).select(
      "username profilePicture lastSeen isOnline about phoneNumber PhoneSuffix "
    ).lean();

    const userWithConversation = await Promise.all(
      users.map(async (user) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [loggedInUser, user._id] },
        }).populate({
          path: "lastMessage",
          select: "content createdAt sender receiver",
        }).lean();

        return {...user, conversation: conversation || null };
      })
    );
    return response(res, 200, "Users retrieved successfully", userWithConversation);
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
}

module.exports = { sendOtp, verifyOtp, updateProfile, logout , checkAuthenticated , getAllUsers};