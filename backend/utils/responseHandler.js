const response = (res, statusCode, message, data = null) => {
  if (!res) {
    console.error("Response object is not provided");
    return;
  }
  const responseObject = {
    status: statusCode < 400 ? "success" : "error",
    message: message,
    data: data,
  };
  return res.status(statusCode).json(responseObject);
};
module.exports = response;
