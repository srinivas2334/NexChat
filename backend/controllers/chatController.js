const response = require("../utils/responseHandler");
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");



exports.sendMessage= async(req,res) =>{
    try {
        const {senderId,receiverId,content,messageStatus} = req.body;
        const file = req.file;

        const participants = [senderId, receiverId].sort();
        // Check if a conversation already exists between the two users
        let conversation = await Conversation.findOne({ participants:participants });
        if (!conversation) {
            // If not, create a new conversation
            conversation = new Conversation({ participants });
            await conversation.save();
        }

        let imageOrVideoUrl = null;
        let contentType = null;

        //handle file upload if there's any
        if (file) {
            const uploadFile = await uploadFileToCloudinary(file);

            if(!uploadFile?.secure_url){
                return response(res,400,"Failed to upload file");
            };
            imageOrVideoUrl = uploadFile?.secure_url;

            if(file.mimetype.startWith("image")){
                contentType = "image";
            } else if(file.mimetype.startWith("video")){
                contentType = "video";
            }else {
                return response(res,400,"Unsupported file type");
            }
        } else if(content?.trim()){
            contentType = "text";
        }else {
            return response(res,400,"Message content or file is required");
        }
        // Create the message object
        const message = new Message({
            conversation: conversation?._id,
            sender: senderId,
            receiver: receiverId,
            content,
            contentType,
            imageOrVideoUrl,
            messageStatus,
        });
        await message.save();

        if(message?.content){
            conversation.lastMessage = message?._id;
        }
        conversation.unreadCount+=1;
        await conversation.save();

        const populatedMessage = await Message.findOne(message?._id)
        .populate("sender","username profilePicture")
        .populate("receiver","username profilePicture")


        // Emit socket event for real-time updates (if using sockets)
        if(req.io && req.socketUserMap){
            const receiverSocketId = req.socketUserMap.get(receiverId);
            if (receiverSocketId) {
                req.io.to(receiverSocketId).emit("newMessage", populatedMessage);
                message.messageStatus = "delivered";
                await message.save();
            }
        }


        return response(res,201,"Message sent successfully",populatedMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        return response(res,500,"Internal server error");
    }
};




//get all conversations for a user
exports.getConversation= async(req,res) =>{
    const userId = req.user.userId;
    try {
        let conversation = await Conversation.find({ participants: userId })
        .populate("participants","username profilePicture isOnline lastSeen")
        .populate({
            path: "lastMessage",
            populate: { path: "sender receiver", select: "username profilePicture" }
        }).sort({ updatedAt: -1 })

        return response(res,200,"Conversations fetched successfully",conversation);
    } catch (error) {
        console.error("Error fetching conversations:", error);
        return response(res,500,"Internal server error");
    }
};




//get messages of a specific conversation
exports.getMessages= async(req,res) =>{
    const {conversationId} = req.params;
    const userId = req.user.userId;
    try {
        const conversation = await Conversation.findById(conversationId);
        if(!conversation){
            return response(res,404,"Conversation not found");
        };

        if(!conversation.participants.includes(userId)){
            return response(res,403,"Access denied to this conversation");
        }

        const messages = await Message.find({ conversation: conversationId })
        .populate("sender","username profilePicture")
        .populate("receiver","username profilePicture")
        .sort("createdAt" );

        await Message.updateMany(
            {
                conversation: conversationId,
                receiver: userId,
                messageStatus: { $in: ["sent", "delivered"] }
            },
            { $set: { messageStatus: "read" }  }
        );

        conversation.unreadCount = 0;
        await conversation.save();

        return response(res,200,"Messages fetched successfully",messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        return response(res,500,"Internal server error");
    }
};



//mark messages as read
exports.markAsRead= async(req,res) =>{
     const {messageIds} = req.body;
    //const { messageIds, conversationId } = req.body;  
    const userId = req.user.userId;
    try {
        //get relevant message to determine sender and conversation
        let messages = await Message.find({_id: {$in: messageIds}, receiver: userId});
        await Message.updateMany(
            {_id: {$in: messageIds}, receiver: userId},
            { $set: { messageStatus: "read" }  }
        );

        //notify to original sender 
        if(req.io && req.socketUserMap){
            for (const message of messages){
                const senderSocketId = req.socketUserMap.get(message.sender.toString());
                if(senderSocketId){
                    const updatedMessage = {
                        _id: message._id,
                        messageStatus: "read"
                    };
                    req.io.to(senderSocketId).emit("message_read", updatedMessage);
                    await message.save();
                }
                }
            }

        return response(res,200,"Messages marked as read successfully",messages);
// Filter only messages where the current user is the receiver
        // const messages = await Message.find({
        //     _id: { $in: messageIds },
        //     receiver: userId
        // });

        // if (messages.length === 0) {
        //     return response(res, 400, "No messages found to mark as read");
        // }

        // // Update messages to read
        // await Message.updateMany(
        //     { _id: { $in: messageIds }, receiver: userId },
        //     { $set: { messageStatus: "read" } }
        // );

        // // Count how many were unread before
        // const countToDecrease = messages.length;

        // // Update conversation unread count
        // await Conversation.updateOne(
        //     { _id: conversationId },
        //     { $inc: { unreadCount: -countToDecrease } }
        // );

        // const updatedMessages = await Message.find({
        //     _id: { $in: messageIds }, receiver: userId
        // });

        // return response(res, 200, "Messages marked as read successfully", updatedMessages);
 
    } catch (error) {
        console.error("Error marking messages as read:", error);
        return response(res,500,"Internal server error");
    }
}


 

exports.deleteMessage= async(req,res) =>{
    const {messageId} = req.params;
    const userId = req.user.userId;
    try {
        const message = await Message.findById(messageId);
        if(!message){
            return response(res,404,"Message not found")
        };

        if(message.sender.toString() !== userId){
            return response(res,403,"Not authorized to delete this message. You can only delete your own messages not others")
        }

        await message.deleteOne();


        // emit socket event for real-time updates (if using sockets)
         if(req.io && req.socketUserMap){
            const receiverSocketId = req.socketUserMap.get(message.receiver.toString());
            if (receiverSocketId) {
                req.io.to(receiverSocketId).emit("message_deleted", messageId);
            }
       }  

        return response(res,200,"message deleted successfully");
    } catch (error) {
        console.error("Error deleting message:", error);
        return response(res,500,"Internal server error");
    }
}