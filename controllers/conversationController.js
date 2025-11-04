import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

// ✅ Create or get existing conversation between two users
// export const getOrCreateConversation = async (req, res) => {
//   try {
//     const { senderId, receiverId } = req.body;

//     if (!senderId || !receiverId)
//       return res.status(400).json({ message: "Both sender and receiver required" });

//     let conversation = await Conversation.findOne({
//       participants: { $all: [senderId, receiverId] },
//       isGroup: false,
//     });

//     if (!conversation) {
//       conversation = await Conversation.create({
//         participants: [senderId, receiverId],
//       });
//     }

//     res.status(201).json(conversation);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
 
// ✅ Get all conversations for a user
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email")
      .populate("lastMessage");
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//new
export const getOrCreateConversation = async (req, res) => {
  try {
    const { senderId, receiverId, receiverPhone } = req.body;

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


//
// if (contact.isRegistered) {
//   await axios.post("/conversation/getOrCreate", {
//     senderId: currentUser._id,
//     receiverId: contact._id,
//   });
// } else {
//   await axios.post("/conversation/getOrCreate", {
//     senderId: currentUser._id,
//     receiverPhone: contact.phone,
//   });
// }

