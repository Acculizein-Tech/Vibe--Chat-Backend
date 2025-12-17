import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { io } from "../index.js";
import Notification from "../models/Notification.js";

// ✅ Send a message
// ✅ Secure version — sender from token
// export const sendMessage = async (req, res) => {
//   try {
//     const sender = req.user.id || req.user._id; // from token
//     const { conversationId, receiver, text } = req.body;

//     if (!conversationId || !receiver || !text) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const message = await Message.create({
//       conversationId,
//       sender,
//       receiver,
//       text,
//     });

//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//     });

//     res.status(201).json(message);
//   } catch (error) {
//     console.error("❌ sendMessage error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// export const sendMessage = async (req, res) => {
//   try {
//     const sender = req.user.id || req.user._id;
//     const { conversationId, receiver, text } = req.body;

//     if (!conversationId || !receiver || !text) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     // 1️⃣ Save message
//     const message = await Message.create({
//       conversationId,
//       sender,
//       receiver,
//       text,
//     });

//     // 2️⃣ Update latest message in conversation
//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//     });

//     res.status(201).json(message);

//     // 3️⃣ Emit real-time event to room
//     io.to(conversationId).emit("messageReceived", message);

//   } catch (error) {
//     console.error("❌ sendMessage error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
export const sendMessage = async (req, res) => {
  try {
    const sender = req.user._id;
    const { conversationId, receiver, text } = req.body;

    if (!conversationId || !receiver || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Save message
    const message = await Message.create({
      conversationId,
      sender,
      receiver,
      text,
    });

    // 2️⃣ Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // 3️⃣ Emit real-time message
    io.to(conversationId).emit("messageReceived", message);

    // 4️⃣ CHECK: is receiver active in this chat?
    const activeUsers = activeConversationUsers.get(conversationId);
    const receiverIsActive = activeUsers?.has(receiver.toString());

    // 5️⃣ Create notification ONLY if inactive
    if (!receiverIsActive) {
      await Notification.create({
        recipient: receiver,
        scope: "USER",
        type: "NEW_MESSAGE",
        title: "New Message",
        message: text.length > 30 ? text.slice(0, 30) + "..." : text,
        data: {
          conversationId,
          senderId: sender
        }
      });
    }

    res.status(201).json(message);

  } catch (error) {
    console.error("❌ sendMessage error:", error);
    res.status(500).json({ error: error.message });
  }
};


// ✅ Fetch all messages in a conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ✅ Edit a message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text, userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only sender can edit
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "You can edit only your messages" });
    }

    message.text = text;
    message.edited = true; // add this field in schema if not already
    await message.save();

    res.status(200).json({ message: "Message updated successfully", data: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete a message
// export const deleteMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const { userId } = req.body;

//     const message = await Message.findById(messageId);
//     if (!message) {
//       return res.status(404).json({ error: "Message not found" });
//     }

//     // Only sender can delete
//     if (message.sender.toString() !== userId) {
//       return res.status(403).json({ error: "You can delete only your messages" });
//     }

//     await Message.findByIdAndDelete(messageId);

//     res.status(200).json({ message: "Message deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// ✅ Delete a message (Updated)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // NEW AUTH LOGIC: Allow if user is in the conversation (not just sender)
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: "You can only delete messages in your conversations" });
    }

    // OLD LOGIC (optional: uncomment if you want to keep sender-only restriction as fallback)
    // if (message.sender.toString() !== userId) {
    //   return res.status(403).json({ error: "You can delete only your messages" });
    // }

    await Message.findByIdAndDelete(messageId);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};