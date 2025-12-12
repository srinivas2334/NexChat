const response = require("../utils/responseHandler");
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const Status = require("../models/Status");
const Message = require("../models/Message");

exports.createStatus = async (req, res) => {
  try {
    const { content, contentType } = req.body;
    const userId = req.user.userId;
    const file = req.file;

    let mediaUrl = null;
    let finalContentType = contentType || "text";

    //handle file upload if there's any
    if (file) {
      const uploadFile = await uploadFileToCloudinary(file);

      if (!uploadFile?.secure_url) {
        return response(res, 400, "Failed to upload file");
      }
      mediaUrl = uploadFile?.secure_url;

      if (file.mimetype.startWith("image")) {
        finalContentType = "image";
      } else if (file.mimetype.startWith("video")) {
        finalContentType = "video";
      } else {
        return response(res, 400, "Unsupported file type");
      }
    } else if (content?.trim()) {
      finalContentType = "text";
    } else {
      return response(res, 400, "Message content or file is required");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Status expires in 24 hours

    // Create the message object
    const status = new Status({
      user: userId,
      content: mediaUrl || content,
      contentType: finalContentType,
      expiresAt,
    });
    await status.save();

    const populatedStatus = await Status.findOne(status?._id)
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture");


      // Emit Socket event for new status
      if(req.io && req.socketUserMap){
        //Broadcast to all connected users except the sender
        for(const [connectedUserId, socketId] of req.socketUserMap){
          if(connectedUserId !== userId){
            req.io.to(socketId).emit("new_status", populatedStatus);
          }
        }
      }

    return response(res, 201, "Status created successfully", populatedStatus);
  } catch (error) {
    console.error("Error Creating Status:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.getStatuses = async (req, res) => {
  try {
    const statuses = await Status.find({
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture")
      .sort({ createdAt: -1 });

    return response(res, 200, "Statuses retrieved successfully", statuses);
  } catch (error) {
    console.error("Error while retrieving statuses:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.viewStatus = async (req, res) => {
  const { statusId } = req.params;
  const userId = req.user.userId;
  try {
    const status = await Status.findById(statusId);
    if (!status) {
      return response(res, 404, "Status not found");
    }
    if (!status.viewers.includes(userId)) {
      status.viewers.push(userId);
      await status.save();

      const updateStatus = await Status.findById(statusId)
        .populate("user", "username profilePicture")
        .populate("viewers", "username profilePicture");

      // Emit Socket event for status viewed
       if(req.io && req.socketUserMap){
        //Broadcast to all connected users except the sender
        const statusOwnerSocketId = req.socketUserMap.get(status.user._id.toString());
        if(statusOwnerSocketId){
          const viewData = {
            statusId,
            viewerId: userId,
            totalViewers: updateStatus.viewers.length,
            viewers: updateStatus.viewers
          }
          req.io.to(statusOwnerSocketId).emit("status_viewed", viewData);
      }
    } else{
      console.log("status owner not connected");
    }
        
    } else {
      console.log("Status already viewed by this user");
    }

    return response(res, 200, "Status viewed successfully");
  } catch (error) {
    console.error("Error while viewing status:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.deleteStatus = async (req, res) => {
  const { statusId } = req.params;
  const userId = req.user.userId;
  try {
    const status = await Status.findById(statusId);
    if (!status) {
      return response(res, 404, "Status not found");
    }

    if ((status, user.toString() !== userId)) {
      return response(res, 403, "You are not authorized to delete this status");
    }

    await status.deleteOne();


    // Emit Socket event for deleted status
       if(req.io && req.socketUserMap){
          for(const [connectedUserId, socketId] of req.socketUserMap){
          if(connectedUserId !== userId){
            req.io.to(socketId).emit("status_deleted", statusId);
          }
        }
       }  

    return response(res, 200, "Status deleted successfully");
  } catch (error) {
    console.error("Error while deleting the status:", error);
    return response(res, 500, "Internal server error");
  }
};
