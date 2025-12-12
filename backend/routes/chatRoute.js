const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { multerMiddleware } = require("../config/cloudinaryConfig");
const chatController = require("../controllers/chatController");


const router = express.Router();

//protected route 
router.post("/send-message", authMiddleware,multerMiddleware,chatController.sendMessage);
router.get("/conversations",authMiddleware,chatController.getConversation);
router.get("/conversations/:conversationId/messages",authMiddleware,chatController.getMessages);


router.put("/messages/read",authMiddleware,multerMiddleware,chatController.markAsRead);
router.delete("/messages/:messageId",authMiddleware,chatController.deleteMessage);

module.exports = router;