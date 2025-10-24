import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

// ✅ Send a message
export const sendMessage = async (req, res) => {
  try {
    const { conversationId, sender, receiver, text } = req.body;

    const message = await Message.create({
      conversationId,
      sender,
      receiver,
      text,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    res.status(201).json(message);
  } catch (error) {
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
