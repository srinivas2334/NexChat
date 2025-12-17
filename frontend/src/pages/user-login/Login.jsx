import React, { useState } from "react";
import useLoginStore from "../../store/useLoginStore";
import countries from "../../utils/countriles";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import useThemeStore from "../../store/themeStore";
import useUserStore from "../../store/useUserStore";
import { useNavigate } from "react-router-dom";
import { motion, useAnimation } from "framer-motion";
import { BsChatDotsFill } from "react-icons/bs";
import { FaChevronDown, FaUser } from "react-icons/fa";
import Spinner from "../../utils/Spinner";
import { FaPaperPlane } from "react-icons/fa";

//validation Schema
const loginValidationSchema = yup
  .object()
  .shape({
    phoneNumber: yup
      .string()
      .nullable()
      .notRequired()
      .matches(/^\d+$/, "Phone number be digit")
      .transform((value, originalValue) =>
        originalValue.trim() === "" ? null : value
      ),
    email: yup
      .string()
      .nullable()
      .notRequired()
      .email("please enter valid email")
      .transform((value, originalValue) =>
        originalValue.trim() === "" ? null : value
      ),
  })
  .test(
    "at-least-one",
    "Either email or phone number is required",
    function (value) {
      return !!(value.phoneNumber || value.email);
    }
  );

const otpValidationSchema = yup.object().shape({
  otp: yup
    .string()
    .length(6, "otp must be excatly 6 digits")
    .required("Otp is required"),
});

const profileValidationSchema = yup.object().shape({
  username: yup.string().required("username is required"),
  agreed: yup.bool().oneOf([true], "You must agree to the terms"),
});

const avatars = [
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Mimi",
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Jasper",
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/6.x/avataaars/svg?seed=Zoe",
];

const Login = () => {
  const { step, setStep, setUserPhoneData, UserPhoneData, resetLoginState } =
    useLoginStore();
  const [phoneNumber, setPhoneNumber] = useState();
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const { theme, setTheme } = useThemeStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, serLoading] = useState(false);

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm({
    resolver: yupResolver(loginValidationSchema),
  });

  const {
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors },
    setValue: setOtpValue,
  } = useForm({
    resolver: yupResolver(otpValidationSchema),
  });

  const {
    register: profileRegister,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    watch,
  } = useForm({
    resolver: yupResolver(profileValidationSchema),
  });

  const filterCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.dialCode.includes(searchTerm)
  );

  const planeControls = useAnimation();

  const onLoginSubmit = async() =>{
    try {
      setLoading(true);
      if(email){
        const response = await sendOtp(null,null,email);
        if(response.status === "success"){
          toast.info("OTP is send to your email");
          setUserPhoneData({email});
          setStep(2);
        }
      } else {
        const response = await sendOtp(phoneNumber,selectedCountry,dialCode);
        if(response.status === "success"){
          toast.info("OTP is send to your Phone Number");
          setUserPhoneData({phoneNumber,phoneSuffix:selectedCountry.dialCode});
          setStep(2);
        }
      }
    } catch (error) {
        console.log(error);
        setError(error.message || "Failed to send OTP")
    } finally {
        setLoading(false);
    }
  }

  const onOtpSubmit = async() => {
    try {
      setLoading(true);
      if(!UserPhoneData){
        throw new Error("Phone or Email data is missing")
      };
      const otpString = otp.join("");
      let response;
      if(UserPhoneData?.email){
        response= await verifyOtp(null,null,otpString,UserPhoneData.email)
      } else {
        response= await verifyOtp(UserPhoneData.phoneNumber,UserPhoneData.phoneSuffix,otpString)
      }
      if(response.status === 'success'){
        toast.success("OTP verify successfully")
        const user = response.data?.user;
        if(user?.username && user?.profilePicture) {
          setUser(user);
          toast.success("welcome back to NexChat");
          navigate('/');
          resetLoginState();
        } else {
            setStep(3);
          }
      }
    } catch (error) {
        console.log(error);
        setError(error.message || "Failed to Verify OTP")
    } finally {
        setLoading(false);
    }
  }


  const handleChange = (e) => {
    const file = e.target.files[0];
    if(file){
      setProfilePictureFile(file);
      setProfilePicture(URL.createObjectURL(file));
    }
  }

  const onProfileSubmit = async(data) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("username",data.username)
      formData.append("agreed",data.agreed)
      if(profilePictureFile){
        formData.append("media",profilePictureFile)
      }else{
        formData.append("profilePicture",selectedAvatar)
      }

      await updateUserProfile(formData);
      toast.success("Welcome back to NexChat");
      navigate('/')
      resetLoginState();
    } catch (error) {
       console.log(error);
        setError(error.message || "Failed to Update userprofile")
    } finally {
        setLoading(false);
    }
  }

  const handleOtpChange = (index,value) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpValue("otp",newOtp.join(""));
    if(value && index<5){
      document.getElementById(`otp-${index+1}`).focus();
    }
  }

  const ProgressBar = () => (
    <div
      className={`w-full ${
        theme === "dark" ? "bg-gray-700" : "text-gray-200"
      } rounded-full h-2.5 mb-6`}
    >
      <div
        className="bg-gradient-to-br from-[#6366F1] to-[#22C55E] h-2.5 rounded-full transition-all duration-500 ease-in-out"
        style={{ width: `${(step / 3) * 100}%` }}
      ></div>
    </div>
  );

 const handleBack = () => {
  setStep(1);
  setUserPhoneData(null);
  setOtp(["", "", "", "", "", ""]);
  setError("");
 }


  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 overflow-hidden
     ${
       theme === "dark"
         ? "bg-gradient-to-br from-[#020617] via-[#020617] to-[#0F172A]"
         : "bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#ECFEFF]"
     }`}
    >
      {/* 🔮 SHINING GLOW ORBS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute w-72 h-72 rounded-full blur-3xl opacity-30
    ${
      theme === "dark"
        ? "bg-[#22D3EE] top-[-80px] left-[-80px]"
        : "bg-[#6366F1] top-[-80px] left-[-80px]"
    }`}
        />
        <div
          className={`absolute w-72 h-72 rounded-full blur-3xl opacity-30
    ${
      theme === "dark"
        ? "bg-[#A3FF12] bottom-[-80px] right-[-80px]"
        : "bg-[#22C55E] bottom-[-80px] right-[-80px]"
    }`}
        />
        {/* Animated Glow Orbs */}
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute w-80 h-80 rounded-full blur-3xl opacity-30
  ${
    theme === "dark"
      ? "bg-[#22D3EE] top-[-120px] left-[-120px]"
      : "bg-[#6366F1] top-[-120px] left-[-120px]"
  }`}
        />

        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute w-80 h-80 rounded-full blur-3xl opacity-30
  ${
    theme === "dark"
      ? "bg-[#A3FF12] bottom-[-120px] right-[-120px]"
      : "bg-[#22C55E] bottom-[-120px] right-[-120px]"
  }`}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full max-w-md p-8 rounded-2xl shadow-xl relative z-10
      ${
        theme === "dark"
          ? "bg-white/5 backdrop-blur-xl border border-white/10 text-white"
          : "bg-white/80 backdrop-blur-xl text-slate-900"
      }`}
      >
        {/* LOGO */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.4,
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
          className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg
        ${
          theme === "dark"
            ? "bg-gradient-to-br from-[#A3FF12] to-[#22D3EE]"
            : "bg-gradient-to-br from-[#6366F1] to-[#22C55E]"
        }`}
        >
          <BsChatDotsFill
            className={`w-14 h-14 ${
              theme === "dark" ? "text-[#020617]" : "text-white"
            }`}
          />
        </motion.div>

        {/* TITLE */}
        <h1
          className={`text-3xl font-bold text-center mb-6 ${
            theme === "dark" ? "text-white" : "text-gray-800"
          }`}
        >
          NexChat Login
        </h1>
        <p
          className={`text-center text-sm mb-6 ${
            theme === "dark" ? "text-white/70" : "text-gray-500"
          }`}
        >
          Next-gen conversations
        </p>

        <ProgressBar />

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {step === 1 && (
          <form className="space-y-4 " onSubmit={handleLoginSubmit(onLoginSubmit)}>
            <p
              className={`text-center ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              } mb-4`}
            >
              Enter Your Phone Number to Receive an OTP
            </p>

            <div className="relative">
              <div className="flex">
                <div className="relative w-1/3">
                  <button
                    type="button"
                    className={`flex-shrink-0 z-10 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center
                    ${
                      theme === "dark"
                        ? "text-white bg-gray-700 border-gray-600"
                        : "text-gray-900 bg-gray-100 border-gray-300"
                    } border rounded-s-lg hover:bg-gray-200 focus:right-4 focus:outline-none focus:ring-gray-100 `}
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    <img
                      src={`https://flagcdn.com/w20/${selectedCountry.alpha2.toLowerCase()}.png`}
                      alt={selectedCountry.name}
                      className="w-5 h-4 mr-2 rounded-sm"
                      loading="lazy"
                    />
                    <span>
                      {/* {selectedCountry.flag}  */}
                      {selectedCountry.dialCode}
                    </span>
                    <FaChevronDown className="ml-2" />
                  </button>

                  {showDropdown && (
                    <div
                      className={`absolute z-10 w-full mt-1 ${
                        theme === "dark"
                          ? "bg-gray-700 border-gray-600"
                          : "bg-white border-gray-300"
                      } border rounded-md shadow-lg max-h-60 overflow-auto`}
                    >
                      <div
                        className={`sticky top-0 ${
                          theme === "dark" ? "bg-gray-700" : "bg-white"
                        } p-2`}
                      >
                        <input
                          type="text"
                          placeholder="Search countries...."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className={`w-full px-2 py-1 border ${
                            theme === "dark"
                              ? "bg-gray-600 border-gray-500 text-white"
                              : "bg-white border-gray-300"
                          } rounded-md text-sm focus:outline-none focus:right-2 focus:ring-green-500`}
                        />
                      </div>
                      {filterCountries.map((country) => (
                        <button
                          key={country.alpha2}
                          type="button"
                          className={`w-full text-left font-emoji px-3 py-2 ${
                            theme === "dark"
                              ? "hover:bg-gray-600"
                              : "hover:bg-gray-100"
                          } focus:outline-none focus:bg-gray-100`}
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowDropdown(false);
                          }}
                        >
                          <img
                            src={`https://flagcdn.com/w20/${country.alpha2.toLowerCase()}.png`}
                            alt={country.name}
                            className="inline-block mr-2"
                          />
                          ({country.dialCode}) {country.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  {...loginRegister("phoneNumber")}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="phone number"
                  className={`w-2/3 px-4 py-2 border ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }  rounded-md focus:outline-none focus:right-2 focus:ring-green-500 ${
                    loginErrors.phoneNumber ? "border-red-500" : ""
                  }`}
                />
              </div>
              {loginErrors.phoneNumber && (
                <p className="text-red-500 text-sm">
                  {loginErrors.phoneNumber.message}
                </p>
              )}
            </div>

            <div className="flex items-center my-4">
              <div className="flex-grow h-px bg-gray-300" />
              <span className="mx-3 text-gray-500 font-medium text-sm">Or</span>
              <div className="flex-grow h-px bg-gray-300 " />
            </div>

            {/* Email input box */}
            <div
              className={`flex items-center border rounded-md px-3 py-2 ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-300"
              }`}
            >
              <FaUser
                className={`mr-2 text-gray-400 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <input
                type="email"
                {...loginRegister("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (Optional)"
                className={`w-full bg-transparent focus:outline-none ${
                  theme === "dark" ? "text-white" : "bg-black "
                }  ${loginErrors.phoneNumber ? "border-red-500" : ""}`}
              ></input>

              {loginErrors.email && (
                <p className="text-red-500 text-sm">
                  {loginErrors.email.message}
                </p>
              )}
            </div>
            <motion.button
              type="submit"
              onHoverStart={() => planeControls.start({ x: 0, opacity: 1 })}
              onHoverEnd={() => planeControls.start({ x: 40, opacity: 0 })}
              onClick={() => {
                planeControls.start({
                  x: 160,
                  y: -20,
                  rotate: 15,
                  opacity: 0,
                  transition: { duration: 0.5, ease: "easeInOut" },
                });
              }}
              className="relative w-full overflow-hidden bg-gradient-to-br from-[#6366F1] to-[#22C55E]
                          text-white py-2 rounded-md flex items-center justify-center
                          transition-all duration-300 ease-in-out
                          hover:shadow-[0_0_25px_rgba(99,102,241,0.7)]
                          active:scale-[0.97]"
            >
              {/* Text */}
              <span className="z-10">{loading ? <Spinner /> : "Send OTP"}</span>

              {/* Paper Plane */}
              {!loading && (
                <motion.span
                  initial={{ x: 40, opacity: 0 }}
                  animate={planeControls}
                  className="absolute right-5"
                >
                  <FaPaperPlane className="text-white text-lg" />
                </motion.span>
              )}
            </motion.button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit(onOtpSubmit)} className="space-y-4">
            <p>
                Please enter the 6-digit OTP send to your {UserPhoneData.phoneSuffix} {" "} {UserPhoneData?.phoneNumber}
            </p>

          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
