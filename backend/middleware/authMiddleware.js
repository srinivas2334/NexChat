// const { response } = require('express');
const response = require("../utils/responseHandler");
const jwt = require('jsonwebtoken');



const authMiddleware = (req, res, next) => {
    const authToken = req.cookies?.auth_token;
    if (!authToken) {
        return response(res,401, 'Unauthorized: No token provided. Please log in.');
    }
    try {
        const decode = jwt.verify(authToken, process.env.JWT_SECRET);
        req.user = decode;
        // console.log('Authenticated user:', req.user);
        next();
    } catch (error) {
        console.log('Authentication error:', error);
        return response(res, 401, 'Unauthorized: Invalid token or expired token. Please log in again.');
    }
}

module.exports = authMiddleware;