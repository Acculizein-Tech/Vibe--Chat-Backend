import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

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



// export const getOrCreateConversation = async (req, res) => {
//   try {
//     const senderId = req.user._id; // ✅ Extracted from token
//     const { receiverId, receiverPhone } = req.body;

//     console.log("senderId:", senderId, "receiverId:", receiverId, "receiverPhone:", receiverPhone);

//     if (!senderId) {
//       return res.status(400).json({ success: false, message: "SenderId required" });
//     }

//     // 🧩 CASE 1 — Registered user (receiverId provided)
//     if (receiverId) {
//       let conversation = await Conversation.findOne({
//         participants: { $all: [senderId, receiverId] },
//         isGroup: false,
//       });

//       if (!conversation) {
//         conversation = await Conversation.create({
//           participants: [senderId, receiverId],
//           status: "active",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         message: "Active conversation ready",
//         status: "active",
//         conversation,
//       });
//     }

//     // 🧩 CASE 2 — Non-registered user (receiverPhone provided)
//     if (receiverPhone) {
//       // 🔍 Check if a user with this phone exists
//       const existingUser = await User.findOne({ phone: receiverPhone });

//       if (existingUser) {
//         // If user exists, behave like CASE 1
//         let conversation = await Conversation.findOne({
//           participants: { $all: [senderId, existingUser._id] },
//           isGroup: false,
//         });

//         if (!conversation) {
//           conversation = await Conversation.create({
//             participants: [senderId, existingUser._id],
//             status: "active",
//           });
//         }

//         return res.status(200).json({
//           success: true,
//           message: "Active conversation ready (found via phone)",
//           status: "active",
//           conversation,
//         });
//       }

//       // 🔗 If not registered, handle invite mode (no ObjectId)
//       let pending = await Conversation.findOne({
//         senderId,
//         receiverPhone,
//         status: "pending",
//       });

//       if (!pending) {
//         pending = await Conversation.create({
//           participants: [senderId], // ✅ only ObjectId here
//           receiverPhone,
//           status: "pending",
//         });
//       }

//       return res.status(200).json({
//         success: false,
//         inviteLink: `https://yourapp.com/invite?phone=${encodeURIComponent(receiverPhone)}`,
//         message: "Pending conversation created (user not registered yet)",
//         status: "pending",
//         conversation: pending,
//       });
//     }

//     return res.status(400).json({
//       success: false,
//       message: "Either receiverId or receiverPhone required",
//     });
//   } catch (error) {
//     console.error("❌ Error in getOrCreateConversation:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


//get those users whose have the converstaion with the logged in user
// Get all users who have a conversation with the logged-in user
export const getChatUsers = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const conversations = await Conversation.find({
      participants: { $in: [userId] },
    })
      .populate("participants", "fullName phone")
      .lean();

    const chatUsers = conversations
      .map(conv => {
        const otherUser = conv.participants.find(
          p => p._id.toString() !== userId
        );
        if (otherUser) {
          return {
            conversationId: conv._id,
            participant: {
              receiver: otherUser._id,
              fullName: otherUser.fullName,
              email: otherUser.email,
              phone: otherUser.phone,
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    // ✅ Fixed duplicate removal
    const uniqueUsers = Array.from(
      new Map(
        chatUsers.map(item => [item.participant.receiver.toString(), item])
      ).values()
    );

    res.status(200).json(uniqueUsers);
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ error: error.message });
  }
};


