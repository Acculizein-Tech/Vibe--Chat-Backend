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
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only sender can delete
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "You can delete only your messages" });
    }

    await Message.findByIdAndDelete(messageId);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};