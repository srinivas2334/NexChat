const { Server } = require('socket.io');
const User = require('../models/User');
const Message = require('../models/Message');



// Map to store online users -> userId , socketId
const onlineUsers = new Map();

// Map to track typing status -> userId -> [conversation]: boolean
const typingUsers = new Map();

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors:{
            origin:process.env.FRONTEND_URL,
            credentials:true,
            methods: ['GET','POST','PUT','DELETE','OPTIONS'],
        },
        pingTimeout: 60000, //disconnect inactive users or sockets after 60 seconds 
    });



    //when a new socket connection is established
    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.id}`);
        let userId = null;

        //handle user connections and mark them online in db

        socket.on("user_connected", async(connectingUserId) => {
            try {
                userId = connectingUserId;
                onlineUsers.set(userId, socket.id);
                socket.join(userId); //join a personal room for direct emits

                //update user status to online in db
                await User.findOneAndUpdate(userId, {
                    isOnline: true,
                    lastSeen: new Date(),
                });

                //notify all connected clients  that this user is online
                io.emit("user_status", {
                    userId,
                    isOnline: true
                });

            } catch (error) {
                console.error("Error in user_connection:",error);

            }
        })

        // Return online status of requested user

        socket.on("get_user_status", (requestedUserId,callback) => {
            const isOnline = onlineUsers.has(requestedUserId)
            callback({
                userId: requestedUserId,
                isOnline,
                lastSeen: isOnline ? new Date() : null,
            });
        })

        //forward message to receiver if online 

        socket.on("send_message", async(message) => {
            try {
                const receiverSocketId = onlineUsers.get(message.receiver?._id);
                if(receiverSocketId){
                    io.to(receiverSocketId).emit("receive_message", message);
                }
            } catch (error) {
                console.error("Error in Sending message:", error);
                socket.emit("message_error", {error:"Failed to send message"});
            }
        })

        //update message as read and notify sender 
        socket.on("message_read", async ({messageId, senderId}) => {
            try {
                await Message.updateMany(
                    {_id: {$in: messageIds} },
                    { $set: { messageStatus: "read" } }
                )

                const senderSocketId = onlineUsers.get(senderId);
                if(senderSocketId){
                    messageIds.forEach((messageId) => {
                        io.to(senderSocketId).emit("message_status_update",{
                            messageId,
                            messageStatus: "read"
                        })
                    })
                }
            } catch (error) {
                console.error("Error in updating message read status:", error);
            }
        })


        //handle typing start event and auto-stop after 3s
        socket.on("typing_start", ({conversationId,receiverId}) => {
            if(!userId || !conversationId || !receiverId) 
                return;

            if(!typingUsers.has(userId))
                typingUsers.set(userId,{});

            const userTyping= typingUsers.get(userId);

            userTyping[conversationId] = true;

            //clear any existing timeout
            if(userTyping[`${conversationId}_timeout`]){
                clearTimeout(userTyping [`${conversationId}_timeout`])
            }

            //auto-stop typing after 3s of inactivity
            userTyping[`${conversationId}_timeout`] = setTimeout(() => {
                userTyping[conversationId] = false;
                socket.to(receiverId).emit("user_typing", {
                    userId,
                    conversationId,
                    isTyping: false
                })
            },3000);

            //notify receiver 
            socket.to(receiverId).emit("user_typing", {
                userId,
                conversationId,
                isTyping: true
            })
        })



        socket.on("typing_stop", ({conversationId, receiverId}) => {
            if(!userId || !conversationId || !receiverId) 
                return;

            if(!typingUsers.has(userId)){
                const typingUsers = typingUsers.get(userId);
                userTyping[conversationId] = false;

                //clear any existing timeout
                if(userTyping[`${conversationId}_timeout`]){
                    clearTimeout (userTyping[`${conversationId}_timeout`]);
                    delete userTyping[`${conversationId}_timeout`];
                }
            }
                
            socket.to(receiverId).emit("user_typing", {
                userId,
                conversationId,
                isTyping: false
            })
        })


        //Add or Update reactions on a message
        socket.on("add_reaction", async({messageId,emoji,userId,reactionUserId}) =>{
            try {
                const message = await Message.findById(messageId);
                if(!message){
                    return;
                }

                const exitingIndex = message.reactions.findIndex(
                    (r) => r.userId.toString() === reactionUserId
                )

                if(exitingIndex > -1){
                    const exiting = message.reactions(exitingIndex)
                    if(exiting.emoji === emoji){
                        //remove same reaction
                        message.reactions.splice(exitingIndex,1);
                    }else{
                        //update to new reaction
                        message.reactions[exitingIndex].emoji = emoji;                    }
                } else {
                    //add new reaction
                    message.reactions.push({
                        user:reactionUserId,
                        emoji
                    })
                }

                await message.save();

                const populatedMessage = await Message.findOne(message?._id)
                .populate("sender","username profilePicture")
                .populate("receiver","username profilePicture")
                .populate("reactions.user","username");

                const reactionUpdated = {
                    messageId,
                    reactions:populatedMessage.reactions
                }

                const senderSocket = onlineUsers.get(populatedMessage.sender._id.toString());
                const receiverSocket = onlineUsers.get(populatedMessage.receiver?._id.toString());

                if(senderSocket) io.to(senderSocket).emit("reaction_update",reactionUpdated)
                
                if(receiverSocket) io.to(receiverSocket).emit("reaction_update",reactionUpdated)

            } catch (error) {
                console.log("Error in adding reaction:", error);
            }
        });

        //handle disconnections and mark user offline
        const handleDisconnect = async() => {
        if(!userId) return;
        try {
            onlineUsers.delete(userId);
            
            //clear all typing timeouts
            if(typingUsers.has(userId)){
                const userTyping = typingUsers.get(userId);
                Object.keys(userTyping).forEach((key) => {
                    if(key.endsWith("_timeout")){
                        clearTimeout(userTyping[key]);
                    }
                })
                typingUsers.delete(userId);
            }

            //update user status to offline in db
            await User.findByIdAndUpdate(userId,{
                isOnline:false,
                lastSeen: new Date(),
            });


            io.emit("user_status", {
                userId,
                isOnline: false,
                lastSeen: new Date(),
            })

            socket.leave(userId);

            console.log(`User disconnected: ${socket.id}`);
        } catch (error) {
            console.error("Error handling disconnection", error);
        }
    }

    //disconnect event 
    socket.on("disconnect", handleDisconnect);
    });
    
    //attach the online user map to the socket server for the external use
    io.socketUserMap = onlineUsers;
    return io;
};

module.exports = initializeSocket;
 