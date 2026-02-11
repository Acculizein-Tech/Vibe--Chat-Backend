import Conversation from "../models/Conversation.js";  
import Message from "../models/Message.js";  
import UserContact from "../models/UserContact.js";  
import User from "../models/user.js";  
// ✅ Create or get existing conversation between two users  
  
   
// ✅ Get all conversations for a user  
export const getUserConversations = async (req, res) => {  
  try {  
    const { userId } = req.params;  
    const conversations = await Conversation.find({  
      participants: userId,  
    })  
      .populate("participants", "name email")  
      .populate("lastMessage");  
      const getExistName = async  
    res.status(200).json(conversations);  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  
  
  
//new  
export const getOrCreateConversation = async (req, res) => {  
  try {  
    // const { senderId, receiverId, receiverPhone } = req.body;  
    const senderId = req.user._id; // ✅ Extract from token  
    const { receiverId, receiverPhone } = req.body;  
    console.log("senderId:", senderId, "receiverId:", receiverId, "receiverPhone:", receiverPhone);  
    if (!senderId)  
      return res.status(400).json({ message: "SenderId required" });  
  
    // 🧩 CASE 1: When receiver is registered  
    if (receiverId) {  
      let conversation = await Conversation.findOne({  
        participants: { $all: [senderId, receiverId] },  
        isGroup: false,  
      });  
  
      if (!conversation) {  
        conversation = await Conversation.create({  
          participants: [senderId, receiverId],  
          status: "active",  
        });  
      }  
  
      return res.status(200).json({  
        message: "Active conversation ready",  
        status: "active",  
        conversation,  
      });  
    }  
  
    // 🧩 CASE 2: When receiver is not registered yet  
    if (receiverPhone) {  
      // Check if already a pending conversation exists  
      let pending = await Conversation.findOne({  
        senderId,  
        receiverPhone,  
        status: "pending",  
      });  
  
      if (!pending) {  
        pending = await Conversation.create({  
          participants: [senderId],  
          receiverPhone,  
          status: "pending",  
        });  
      }  
  
      return res.status(200).json({  
        message: "Pending conversation created (user not registered yet)",  
        status: "pending",  
        conversation: pending,  
      });  
    }  
  
    res.status(400).json({ message: "Either receiverId or receiverPhone required" });  
  } catch (error) {  
    console.error("❌ Error in getOrCreateConversation:", error);  
    res.status(500).json({ message: "Server error", error: error.message });  
  }  
};  
  
//get those users whose have the converstaion with the logged in user  
// Get all users who have a conversation with the logged-in user  
export const getChatUsers = async (req, res) => {  
  try {  
    const ownerId = req.user._id;  
  
    const conversations = await Conversation.find({  
      participants: ownerId,  
    }).lean();  
  
    const uniqueUsers = [];  
  
    for (const convo of conversations) {  
      const otherUserId = convo.participants.find(  
        (id) => id.toString() !== ownerId.toString()  
      );  
  
      if (!otherUserId) continue;  
  
      const user = await User.findById(otherUserId)  
        .select("fullName firstName lastName phone username profile.avatar userImages")  
        .lean();  
  
      const contact = await UserContact.findOne({  
        owner: ownerId,  
        linkedUser: otherUserId,  
        isBlocked: false,  
      }).lean();  
  
      // 🔥 IMPORTANT FIX  
      if (!user && !contact) continue;  
  
      const userFullName =  
        user?.fullName ||  
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||  
        user?.username ||  
        "";  
      const lastMessage = await Message.findOne({  
        conversationId: convo._id,  
      }).sort({ createdAt: -1 }).select("text createdAt").lean();  
       
      uniqueUsers.push({  
        conversationId: convo._id,  
        participant: {  
          receiver: otherUserId,  
          fullName: userFullName,  
          phone: user?.phone || "",
          userImages: user?.userImages || [],
          profileAvatar: user?.profile?.avatar || null,  
          existingName: contact  
            ? `${contact.firstName} ${contact.lastName}`.trim()  
            : null,  
            existingUserId: contact ? contact._id : null,  
            lastMessage: lastMessage?.text || null, 
            lastMessageAt: lastMessage?.createdAt || null,  
        },  
      })  
        
    }  
  
    res.json({ status: "Success", uniqueUsers });  
  } catch (err) {  
    console.error("❌ getChatUsers error", err);  
    res.status(500).json({ status: "Error", message: err.message });  
  }  
};


//\delete a conversation by ID
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if the logged-in user is a participant of the conversation
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Conversation.findByIdAndDelete(conversationId);
    await Message.deleteMany({ conversationId });

    res.json({ message: "Conversation and its messages deleted successfully" });
  } catch (error) {
    console.error("❌ deleteConversation error", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};