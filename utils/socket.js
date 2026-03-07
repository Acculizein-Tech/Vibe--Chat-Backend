import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import GroupConversation from "../models/GroupConversation.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "./pushService.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import {
  encryptMessageText,
  materializeMessageForClient,
  decryptMessageText,
} from "./messageCrypto.js";

import {
  onlineUsers,
  activeConversationViewers,
  userAppState,
} from "./socketState.js";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("ðŸŸ¢ Socket connected:", socket.id);

    const resolveConversation = async (conversationId) => {
      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return null;
      }

      const direct = await Conversation.findById(conversationId)
        .select("participants isGroup lastMessage")
        .lean();
      if (direct) {
        return { ...direct, source: "direct", isGroup: Boolean(direct.isGroup) };
      }

      const group = await GroupConversation.findById(conversationId)
        .select("participants groupName lastMessage")
        .lean();
      if (group) {
        return { ...group, source: "group", isGroup: true };
      }
      return null;
    };

    const updateLastMessageRef = async ({ conversationId, source, messageId }) => {
      if (!conversationId || !source || !messageId) return;
      if (source === "group") {
        await GroupConversation.findByIdAndUpdate(conversationId, {
          lastMessage: messageId,
        });
        return;
      }
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: messageId,
      });
    };

    const getActiveSocketId = (userId) => {
      const uid = String(userId || "").trim();
      if (!uid) return "";
      const sid = String(onlineUsers.get(uid) || "").trim();
      if (!sid) return "";
      const socketRef = io?.sockets?.sockets?.get(sid);
      if (!socketRef || socketRef.disconnected) {
        // stale online map entry cleanup
        if (onlineUsers.get(uid) === sid) {
          onlineUsers.delete(uid);
        }
        return "";
      }
      return sid;
    };

    const emitToUser = (userId, event, payload) => {
      const uid = String(userId || "");
      if (!uid) return;
      io.to(`user:${uid}`).emit(event, payload);
      const sid = getActiveSocketId(uid);
      if (sid) io.to(sid).emit(event, payload);
    };

    const isUserOnline = (userId) => {
      return Boolean(getActiveSocketId(userId));
    };

    const markMessagesDeliveredForUser = async ({
      conversationId,
      userId,
      messageIds = [],
    }) => {
      if (
        !conversationId ||
        !userId ||
        !mongoose.Types.ObjectId.isValid(conversationId) ||
        !mongoose.Types.ObjectId.isValid(userId)
      ) {
        return { deliveredIds: [], deliveredAt: null };
      }
      const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const idsFilter = Array.isArray(messageIds) && messageIds.length
        ? {
            _id: {
              $in: messageIds
                .map((id) => String(id || ""))
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
                .map((id) => new mongoose.Types.ObjectId(id)),
            },
          }
        : {};

      const target = await Message.find(
        {
          conversationId: conversationObjectId,
          sender: { $ne: userObjectId },
          readBy: { $ne: userObjectId },
          status: "sent",
          ...idsFilter,
        },
        { _id: 1, sender: 1, deliveryInfo: 1 },
      ).lean();
      if (!target.length) return { deliveredIds: [], deliveredAt: null };

      const deliveredIds = target.map((m) => String(m._id || "")).filter(Boolean);
      const deliveredAt = new Date();
      await Message.updateMany(
        {
          _id: {
            $in: deliveredIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
        { $set: { status: "delivered" } },
      );

      await Message.bulkWrite(
        target.map((doc) => {
          const existing = Array.isArray(doc?.deliveryInfo)
            ? doc.deliveryInfo.filter(
                (di) => String(di?.userId || "") !== String(userObjectId),
              )
            : [];
          existing.push({ userId: userObjectId, deliveredAt });
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { deliveryInfo: existing } },
            },
          };
        }),
      );

      const senderIds = Array.from(
        new Set(
          target
            .map((m) => String(m?.sender || "").trim())
            .filter(Boolean),
        ),
      );

      return { deliveredIds, deliveredAt, senderIds };
    };

    const markPendingMessagesDeliveredForUser = async ({ userId }) => {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return { updates: [], deliveredAt: null };
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);
      const pending = await Message.find(
        {
          sender: { $ne: userObjectId },
          readBy: { $ne: userObjectId },
          status: "sent",
          $or: [
            { receiver: String(userId) },
            { receiver: userObjectId },
            { receiver: { $in: [String(userId)] } },
            { receiver: { $in: [userObjectId] } },
          ],
        },
        { _id: 1, conversationId: 1, sender: 1, deliveryInfo: 1 },
      ).lean();

      if (!pending.length) return { updates: [], deliveredAt: null };

      const deliveredAt = new Date();
      const ids = pending.map((m) => m._id);
      await Message.updateMany(
        { _id: { $in: ids } },
        { $set: { status: "delivered" } },
      );

      await Message.bulkWrite(
        pending.map((doc) => {
          const existing = Array.isArray(doc?.deliveryInfo)
            ? doc.deliveryInfo.filter(
                (di) => String(di?.userId || "") !== String(userObjectId),
              )
            : [];
          existing.push({ userId: userObjectId, deliveredAt });
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { deliveryInfo: existing } },
            },
          };
        }),
      );

      const perConversation = new Map();
      pending.forEach((doc) => {
        const cid = String(doc.conversationId || "");
        if (!cid) return;
        if (!perConversation.has(cid)) {
          perConversation.set(cid, { messageIds: [], senderIds: new Set() });
        }
        const bucket = perConversation.get(cid);
        bucket.messageIds.push(String(doc._id));
        const senderId = String(doc?.sender || "").trim();
        if (senderId) bucket.senderIds.add(senderId);
      });

      return {
        deliveredAt,
        updates: Array.from(perConversation.entries()).map(
          ([conversationId, info]) => ({
            conversationId,
            messageIds: info.messageIds,
            senderIds: Array.from(info.senderIds),
          }),
        ),
      };
    };

    // Dedupe repeated conversationOpen acknowledgements from same socket/user.
    const lastReadResetEmitAt = new Map();
    const READ_RESET_DEDUPE_MS = 1200;

    const emitChatListPatch = async ({ conversationId, text, createdAt }) => {
      if (!conversationId) return;
      const conv = await resolveConversation(conversationId);
      if (!conv?.participants?.length) return;

      const payload = {
        conversationId,
        text: text ?? "",
        createdAt: createdAt || new Date().toISOString(),
      };

      conv.participants.forEach((uid) => {
        const sid = getActiveSocketId(uid.toString());
        if (sid) io.to(sid).emit("chat:list:patch", payload);
      });
    };
    /* ========================= 
       REGISTER USER 
    ========================== */
    socket.on("register", async (userId) => {
      if (!userId) return;
      const nextUserId = userId.toString();
      const prevUserId = String(socket.userId || "").trim();

      // Account switched on same socket: clear old mapping first.
      if (prevUserId && prevUserId !== nextUserId) {
        if (onlineUsers.get(prevUserId) === socket.id) {
          onlineUsers.delete(prevUserId);
        }
        userAppState.delete(prevUserId);
        socket.leave(`user:${prevUserId}`);
      }

      socket.userId = nextUserId;
      onlineUsers.set(socket.userId, socket.id);
      socket.join(`user:${socket.userId}`);
      console.log("âœ… User registered:", socket.userId);

      try {
        const { updates, deliveredAt } =
          await markPendingMessagesDeliveredForUser({ userId: socket.userId });
        if (updates.length) {
          const deliveredAtIso =
            deliveredAt?.toISOString?.() || new Date().toISOString();
          updates.forEach(({ conversationId, messageIds, senderIds = [] }) => {
            const deliveredPayload = {
              conversationId: String(conversationId),
              userId: String(socket.userId),
              messageIds,
              deliveredAt: deliveredAtIso,
            };
            io.to(String(conversationId)).emit("messagesDelivered", deliveredPayload);
            emitToUser(String(socket.userId), "messagesDelivered", deliveredPayload);
            senderIds
              .filter((sid) => String(sid) && String(sid) !== String(socket.userId))
              .forEach((sid) => {
                emitToUser(String(sid), "messagesDelivered", deliveredPayload);
              });
          });
        }
      } catch (err) {
        console.error("register delivery-sync error:", err);
      }
    });

    socket.on("unregister", (userId) => {
      const uid = String(userId || socket.userId || "").trim();
      if (!uid) return;
      if (onlineUsers.get(uid) === socket.id) {
        onlineUsers.delete(uid);
      }
      userAppState.delete(uid);
      socket.leave(`user:${uid}`);
    });

    /* ========================= 
       JOIN ROOM 
    ========================== */
    socket.on("joinRoom", async ({ conversationId, userId }) => {
      if (!conversationId) return;
      socket.join(conversationId.toString());
      const uid = String(userId || socket.userId || "").trim();
      if (!uid) return;
      try {
        const { deliveredIds, deliveredAt, senderIds = [] } = await markMessagesDeliveredForUser({
          conversationId: String(conversationId),
          userId: uid,
        });
        if (deliveredIds.length) {
          const deliveredPayload = {
            conversationId: String(conversationId),
            userId: uid,
            messageIds: deliveredIds,
            deliveredAt: deliveredAt?.toISOString?.() || new Date().toISOString(),
          };
          io.to(String(conversationId)).emit("messagesDelivered", deliveredPayload);
          emitToUser(uid, "messagesDelivered", deliveredPayload);
          senderIds
            .filter((sid) => String(sid) && String(sid) !== String(uid))
            .forEach((sid) => {
              emitToUser(String(sid), "messagesDelivered", deliveredPayload);
            });
        }
      } catch (err) {
        console.error("joinRoom delivery-sync error:", err);
      }
    });

    /* ========================= 
       CHAT OPEN / CLOSE 
    ========================== */
    socket.on("conversationOpen", async ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      console.log("?? Chat open:", conversationId, userId);

      try {
        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(userId)
        ) {
          return;
        }

        const conversation = await resolveConversation(conversationId);
        const isParticipant = !!conversation?.participants?.some(
          (p) => String(p) === String(userId),
        );
        if (!isParticipant) return;

        if (!activeConversationViewers.has(conversationId)) {
          activeConversationViewers.set(conversationId, new Set());
        }
        activeConversationViewers.get(conversationId).add(userId.toString());

        const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const unreadMessagesForUser = await Message.find(
          {
            conversationId: conversationObjectId,
            sender: { $ne: userObjectId },
            readBy: { $ne: userObjectId },
          },
          { _id: 1 },
        ).lean();

        const unreadMessageIds = unreadMessagesForUser.map((m) =>
          String(m?._id || ""),
        );

        if (unreadMessageIds.length) {
          const { deliveredIds, deliveredAt } = await markMessagesDeliveredForUser({
            conversationId: String(conversationId),
            userId: String(userId),
            messageIds: unreadMessageIds,
          });
          if (deliveredIds.length) {
            const deliveredPayload = {
              conversationId: conversationId.toString(),
              userId: userId.toString(),
              messageIds: deliveredIds,
              deliveredAt:
                deliveredAt?.toISOString?.() || new Date().toISOString(),
            };
            io.to(conversationId.toString()).emit("messagesDelivered", deliveredPayload);
            emitToUser(userId, "messagesDelivered", deliveredPayload);
          }

          const readAt = new Date();
          await Message.updateMany(
            {
              _id: {
                $in: unreadMessageIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
            {
              $addToSet: { readBy: userObjectId },
              $set: { status: "read" },
            },
          );

          const readInfoDocs = await Message.find(
            {
              _id: {
                $in: unreadMessageIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
            { _id: 1, readInfo: 1 },
          ).lean();

          if (readInfoDocs.length) {
            await Message.bulkWrite(
              readInfoDocs.map((doc) => {
                const existing = Array.isArray(doc?.readInfo)
                  ? doc.readInfo.filter(
                      (ri) => String(ri?.userId || "") !== String(userObjectId),
                    )
                  : [];
                existing.push({ userId: userObjectId, readAt });
                return {
                  updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { readInfo: existing } },
                  },
                };
              }),
            );
          }

          io.to(conversationId.toString()).emit("messagesRead", {
            conversationId: conversationId.toString(),
            userId: userId.toString(),
            messageIds: unreadMessageIds,
            readAt: readAt.toISOString(),
          });
        }

        const targetNotifications = await Notification.find(
          {
            recipient: userObjectId,
            type: "NEW_MESSAGE",
            "data.conversationId": conversationObjectId,
            isRead: false,
          },
          { _id: 1 },
        ).lean();

        if (targetNotifications.length) {
          await Notification.updateMany(
            {
              _id: { $in: targetNotifications.map((n) => n._id) },
            },
            { $set: { isRead: true } },
          );
        }

        const unreadCount = await Notification.countDocuments({
          recipient: userId,
          isRead: false,
        });
        const resetPayload = {
          conversationId: conversationId.toString(),
          unread: 0,
          unreadTotal: unreadCount,
          updatedAt: new Date().toISOString(),
        };
        const dedupeKey = `${socket.id}:${String(userId)}:${String(conversationId)}`;
        const nowTs = Date.now();
        const lastTs = lastReadResetEmitAt.get(dedupeKey) || 0;

        if (nowTs - lastTs >= READ_RESET_DEDUPE_MS) {
          lastReadResetEmitAt.set(dedupeKey, nowTs);
          emitToUser(userId, "conversationRead", resetPayload);
          emitToUser(userId, "chat:unread:reset", resetPayload);
          emitToUser(userId, "chat:list:patch", {
            conversationId: conversationId.toString(),
            unread: 0,
            createdAt: resetPayload.updatedAt,
          });
          emitToUser(userId, "unreadCount", unreadCount);
        }
      } catch (err) {
        console.error("conversationOpen read-sync error:", err);
      }
    });

    socket.on("conversationClose", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      activeConversationViewers
        .get(conversationId)
        ?.delete(userId.toString());

      console.log("âŒ Chat closed:", conversationId, userId);
    });

    /* ========================= 
       APP STATE (INFO ONLY) 
    ========================== */
    socket.on("appState", (state) => {
      if (!socket.userId) return;
      userAppState.set(socket.userId, state);
      console.log("ðŸ“± AppState:", socket.userId, state);
    });

    /* ========================= 
       SEND MESSAGE (FIXED) 
    ========================== */
    socket.on("sendMessage", async (data) => {
      try {
        const { sender, receiver, text, conversationId, tempId } = data;
        const incomingMedia = Array.isArray(data?.media) ? data.media : [];
        const mediaPayload = incomingMedia
          .map((m) => ({
            url: String(m?.url || "").trim(),
            type: String(m?.type || "").trim(),
          }))
          .filter(
            (m) =>
              m.url &&
              ["image", "video", "audio", "file"].includes(String(m.type)),
          );
        const hasText = Boolean(String(text || "").trim());
        const hasMedia = mediaPayload.length > 0;
        if (!sender || !conversationId || (!hasText && !hasMedia)) return;
        const conversation = await resolveConversation(conversationId);
        if (!conversation) return;
        const isGroupConversation = Boolean(conversation.isGroup);
        if (!isGroupConversation && !receiver) return;
        if (
          !isGroupConversation &&
          receiver &&
          sender.toString() === receiver.toString()
        ) return;
        const textValue = String(text || "");
        const cryptoCache = new Map();
        const encrypted = await encryptMessageText({
          conversationId,
          text: textValue,
          cache: cryptoCache,
        });
        const recipients = (
          isGroupConversation
            ? (conversation.participants || [])
                .map((id) => String(id || ""))
                .filter((id) => id && id !== String(sender))
            : [String(receiver || "").trim()].filter(Boolean)
        ).map((id) => String(id));

        // Snapshot once to avoid racey status decisions.
        const viewers = new Set(
          activeConversationViewers.get(String(conversationId)) || []
        );
        const onlineRecipientIds = recipients.filter((id) => isUserOnline(id));
        const readRecipientIds = recipients.filter((id) => viewers.has(id));

        // Rules:
        // 1) offline -> sent
        // 2) online  -> delivered
        // 3) active viewer -> read (applied after initial create)
        const allRecipientsDelivered =
          recipients.length > 0 &&
          onlineRecipientIds.length === recipients.length;

        const initialStatus = allRecipientsDelivered ? "delivered" : "sent";

        const now = new Date();

        /* 1ï¸âƒ£ SAVE MESSAGE */
        const msg = await Message.create({
          sender,
          receiver: isGroupConversation ? recipients : receiver,
          conversationId,
          status: initialStatus,
          deliveryInfo: onlineRecipientIds.map((id) => ({
            userId: id,
            deliveredAt: now,
          })),
          readBy: [sender],
          readInfo: [{ userId: sender, readAt: now }],
          media: mediaPayload,
          ...encrypted,
        });

        await updateLastMessageRef({
          conversationId,
          source: conversation.source,
          messageId: msg._id,
        });

        /* 2ï¸âƒ£ REALTIME MESSAGE */
        const outgoingMsg = {
          ...(await materializeMessageForClient(msg, cryptoCache)),
          tempId: tempId || null,
        };
        io.to(conversationId.toString()).emit("messageReceived", outgoingMsg);
        (conversation.participants || []).forEach((uid) => {
          emitToUser(String(uid), "messageReceived", outgoingMsg);
        });








        /* ================================ 
           ðŸ”¥ NEW PART â€“ CHAT LIST UPDATE 
        ================================= */

        const mediaPreviewText = hasMedia
          ? mediaPayload[0].type === "image"
            ? mediaPayload.length > 1
              ? "Photos"
              : "Photo"
            : mediaPayload[0].type === "video"
              ? mediaPayload.length > 1
                ? "Videos"
                : "Video"
              : mediaPayload[0].type === "audio"
                ? mediaPayload.length > 1
                  ? "Audios"
                  : "Audio"
                : mediaPayload.length > 1
                  ? "Documents"
                  : "Document"
          : "";
        const previewLabel = textValue || mediaPreviewText;

        const chatListPayload = {
          conversationId,
          text: previewLabel,
          sender: sender,
          receiver: isGroupConversation ? recipients : receiver,
          createdAt: msg.createdAt,
        };
        const participantIds = (conversation.participants || []).map((p) =>
          p.toString(),
        );
        participantIds.forEach((uid) => {
          const sid = getActiveSocketId(uid);
          if (sid) io.to(sid).emit("chat:list:update", chatListPayload);
        });
        console.log("ðŸ’¬ Chat list update sent", chatListPayload);
        /* ================================ 
           â¬†ï¸ à¤¯à¤¹à¥€ MISSING THA 
     
     
            /* 3ï¸âƒ£ CHECK IF RECEIVER IS IN SAME CHAT */
        if (onlineRecipientIds.length) {
          for (const recipientId of onlineRecipientIds) {
            const deliveredPayload = {
              conversationId: String(conversationId),
              userId: String(recipientId),
              messageIds: [String(msg._id)],
              deliveredAt: now.toISOString(),
            };
            io.to(String(conversationId)).emit("messagesDelivered", deliveredPayload);
            emitToUser(String(sender), "messagesDelivered", deliveredPayload);
            emitToUser(String(recipientId), "messagesDelivered", deliveredPayload);
          }
        }

        if (readRecipientIds.length) {
          const readAt = now;
          const nextReadBy = Array.from(
            new Set([String(sender), ...readRecipientIds.map((id) => String(id))]),
          );
          const nextReadInfo = [
            { userId: sender, readAt },
            ...readRecipientIds.map((id) => ({ userId: id, readAt })),
          ];
          await Message.findByIdAndUpdate(msg._id, {
            $set: {
              status: "read",
              readBy: nextReadBy,
              readInfo: nextReadInfo,
            },
          });

          for (const recipientId of readRecipientIds) {
            io.to(String(conversationId)).emit("messagesRead", {
              conversationId: String(conversationId),
              userId: String(recipientId),
              messageIds: [String(msg._id)],
              readAt: now.toISOString(),
            });
          }
        }
        const senderUser = await User.findById(sender)
          .select("fullName username phone")
          .lean();
        const senderLabel =
          String(
            senderUser?.fullName ||
              senderUser?.username ||
              senderUser?.phone ||
              "Ryngales",
          ).trim() || "Ryngales";
        const groupLabel =
          String(conversation?.groupName || "").trim() || "Group";
        const previewText = previewLabel.length > 80
          ? `${previewLabel.slice(0, 80).trimEnd()}...`
          : previewLabel;
        const chatThreadKey = `chat:${String(conversationId)}`;

        /* 4? CREATE DB NOTIFICATION (GROUP + DIRECT) */
        let deliveredNotifications = 0;
        for (const recipientId of recipients) {
          if (viewers.has(recipientId)) continue;

          const notification = await Notification.create({
            recipient: recipientId,
            scope: "USER",
            type: "NEW_MESSAGE",
            title: isGroupConversation ? groupLabel : "New Message",
            message: isGroupConversation
              ? `${senderLabel}: ${previewText}`
              : previewText,
            data: {
              conversationId,
              senderId: sender,
              isGroup: isGroupConversation,
              groupName: isGroupConversation ? groupLabel : "",
              senderLabel,
              threadKey: chatThreadKey,
            },
            isRead: false,
          });
          deliveredNotifications += 1;

          const recipientSocketId = getActiveSocketId(recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit("newNotification", notification);
            const unreadCount = await Notification.countDocuments({
              recipient: recipientId,
              isRead: false,
            });
            io.to(recipientSocketId).emit("unreadCount", unreadCount);
          }

          const recipientUser = await User.findById(recipientId)
            .select("pushToken")
            .lean();
          if (recipientUser?.pushToken) {
            await sendPushNotification({
              pushToken: recipientUser.pushToken,
              title: isGroupConversation ? groupLabel : `${senderLabel} • Ryngales`,
              body: isGroupConversation
                ? `${senderLabel}: ${previewText}`
                : previewText,
              subtitle: isGroupConversation ? senderLabel : undefined,
              threadKey: chatThreadKey,
              data: {
                type: "CHAT_MESSAGE",
                conversationId,
                senderId: sender,
                isGroup: isGroupConversation,
                groupName: isGroupConversation ? groupLabel : "",
                senderLabel,
                threadKey: chatThreadKey,
              },
            });
          }
        }
        if (!deliveredNotifications) {
          console.log("Same chat open -> no notification / no push");
        }
      } catch (err) {
        console.error("âŒ sendMessage error:", err);
      }
    });

    /* =========================
       âœï¸ EDIT MESSAGE (SOCKET REALTIME)
    ========================== */
    socket.on("editMessage", async (data) => {
      try {
        const { sender, messageId, conversationId, text } = data || {};
        if (!sender || !messageId || !conversationId || !text?.trim()) {
          return socket.emit("edit:error", { message: "Invalid edit payload" });
        }
        const textValue = text.trim();
        const encrypted = await encryptMessageText({
          conversationId,
          text: textValue,
        });

        const updated = await Message.findOneAndUpdate(
          {
            _id: messageId,
            conversationId,
            sender,
          },
          { $set: { ...encrypted, isEdited: true } },
          { new: true },
        );

        if (!updated) {
          return socket.emit("edit:error", {
            message: "Message not found or not editable",
          });
        }

        io.to(conversationId.toString()).emit("messageEdited", {
          messageId: updated._id,
          conversationId,
          text: textValue,
          updatedAt: updated.updatedAt,
        });

        const convo = await resolveConversation(conversationId);
        const isLatestMessage =
          convo?.lastMessage &&
          String(convo.lastMessage) === String(updated._id);
        if (isLatestMessage) {
          await emitChatListPatch({
            conversationId,
            text: textValue,
            createdAt: updated.updatedAt,
          });
        }

        socket.emit("edit:success", {
          messageId: updated._id,
          conversationId,
        });
      } catch (err) {
        console.error("editMessage error:", err);
        socket.emit("edit:error", { message: "Failed to edit message" });
      }
    });

    /* =========================
   ðŸ” FORWARD MESSAGE (PRODUCTION)
========================= */


   socket.on("forwardMessage", async (data) => {
  try {
    const {
      sender,
      messageId,
      text,
      messageIds = [],
      targetConversationIds = [],
      mediaByMessageId = {},
    } = data;

    /* ============================================================
       ðŸ“¥ COLLECT ORIGINALS (The "Baap" Fix)
    ============================================================ */
    let originals = [];

    // 1. Array banao saari IDs ka jo frontend se aayi hain
    const incomingIds = [...messageIds, messageId].filter(Boolean);
    console.log(`ðŸ” [FORWARD] Incoming IDs: ${incomingIds.join(", ")}`);

    // 2. ðŸ”¥ Sabse Zaroori: Sirf wahi IDs filter karo jo asli 24-char Hex hain
    // Isse 'temp-...' waali IDs query tak pahunchengi hi nahi, toh CastError nahi aayega
    const validMongoIds = incomingIds.filter(id => 
      id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
    );
    
    const tempIds = incomingIds.filter(id => 
      id && typeof id === 'string' && id.startsWith("temp-")
    );
    
    if (tempIds.length > 0) {
      console.warn(`âš ï¸ [FORWARD] Filtering out tempIds (not yet synced): ${tempIds.join(", ")}`);
    }
    console.log(`âœ… [FORWARD] Valid Mongo IDs: ${validMongoIds.join(", ")}`);

    // 3. Agar valid IDs mili, tabhi DB query karo
    if (validMongoIds.length > 0) {
      originals = await Message.find({ _id: { $in: validMongoIds } }).lean();
      console.log(`âœ… [FORWARD] Found ${originals.length} messages in DB`);
    }

    // 4. ðŸ”¥ Race Condition Fallback (Fresh Message Case)
    // Agar DB mein kuch nahi mila (kyunki IDs temp thin) toh text fallback use karo
    if (originals.length === 0 && (text || Object.keys(mediaByMessageId || {}).length)) {
      console.log("âš ï¸ [FORWARD] DB sync pending (temp-id case), using fallback text");
      const firstIncomingId = String(incomingIds[0] || "").trim();
      const fallbackMediaKey =
        firstIncomingId || String(Object.keys(mediaByMessageId || {})[0] || "").trim();
      const fallbackMedia = Array.isArray(mediaByMessageId?.[fallbackMediaKey])
        ? mediaByMessageId[fallbackMediaKey]
        : [];
      originals = [{ text: text || "", sender: sender, media: fallbackMedia }];
    }

    if (originals.length === 0) {
      console.error("âŒ [FORWARD] No messages found and no fallback text provided");
      return socket.emit("forward:error", { message: "Nothing to forward" });
    }

    /* =========================
       ðŸ” BUILD + INSERT
    ========================== */
    const messagesToInsert = [];
    const targetMetaMap = new Map();

    for (const conversationId of targetConversationIds) {
      // Conversation ID check
      if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) continue;

      const conv = await resolveConversation(conversationId);
      if (!conv) continue;
      targetMetaMap.set(String(conversationId), conv);

        let receiver = null;
        let deliveryUserIds = [];
        if (conv.participants) {
          const targetIds = conv.participants
            .map((p) => p.toString())
            .filter((id) => id !== sender.toString());
          receiver = conv.isGroup ? targetIds : targetIds[0] || null;
          deliveryUserIds = conv.isGroup
            ? targetIds
            : receiver
              ? [String(receiver)]
              : [];
        }

      const normalizeForwardMediaType = (rawType, mimeType, mediaUrl) => {
        const t = String(rawType || "").trim().toLowerCase();
        const mime = String(mimeType || "").trim().toLowerCase();
        if (["image", "video", "audio", "file"].includes(t)) return t;
        if (t === "document") return "file";
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("video/")) return "video";
        if (mime.startsWith("audio/")) return "audio";
        const url = String(mediaUrl || "").toLowerCase();
        if (/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)(\?|$)/i.test(url)) return "image";
        if (/\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(url)) return "video";
        if (/\.(mp3|wav|m4a|aac|ogg|opus)(\?|$)/i.test(url)) return "audio";
        if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)(\?|$)/i.test(url)) return "file";
        if (mime || t) return "file";
        return "";
      };

      for (const original of originals) {
        const originalText = await decryptMessageText(original);
        const originalMediaList = Array.isArray(original?.media)
          ? original.media
          : Array.isArray(original?.attachments)
            ? original.attachments
            : Array.isArray(original?.files)
              ? original.files
              : [];
        let copiedMedia = Array.isArray(originalMediaList)
          ? originalMediaList
              .map((m) => ({
                url: String(
                  m?.url || m?.uri || m?.fileUrl || m?.path || m?.src || "",
                ).trim(),
                type: normalizeForwardMediaType(
                  m?.type,
                  m?.mimeType || m?.mimetype,
                  m?.url || m?.uri || m?.fileUrl || m?.path || m?.src || "",
                ),
                thumbnailUrl: String(m?.thumbnailUrl || "").trim(),
                fileName: String(m?.fileName || m?.name || "").trim(),
                mimeType: String(m?.mimeType || m?.mimetype || "").trim(),
                sizeBytes: Number(m?.sizeBytes || m?.size || 0) || null,
                pageCount: Number(m?.pageCount || m?.pages || 0) || null,
              }))
              .filter(
                (m) =>
                  m.url &&
                    ["image", "video", "audio", "file"].includes(String(m.type)),
              )
          : [];
        if (!copiedMedia.length) {
          const originalId = String(original?._id || "").trim();
          const fallbackMedia = Array.isArray(mediaByMessageId?.[originalId])
            ? mediaByMessageId[originalId]
            : [];
          copiedMedia = fallbackMedia
            .map((m) => ({
              url: String(
                m?.url || m?.uri || m?.fileUrl || m?.path || m?.src || "",
              ).trim(),
              type: normalizeForwardMediaType(
                m?.type,
                m?.mimeType || m?.mimetype,
                m?.url || m?.uri || m?.fileUrl || m?.path || m?.src || "",
              ),
              thumbnailUrl: String(m?.thumbnailUrl || "").trim(),
              fileName: String(m?.fileName || m?.name || "").trim(),
              mimeType: String(m?.mimeType || m?.mimetype || "").trim(),
              sizeBytes: Number(m?.sizeBytes || m?.size || 0) || null,
              pageCount: Number(m?.pageCount || m?.pages || 0) || null,
            }))
            .filter(
              (m) =>
                m.url &&
                ["image", "video", "audio", "file"].includes(String(m.type)),
            );
        }
        const encrypted = await encryptMessageText({
          conversationId,
          text: originalText || "",
        });
        messagesToInsert.push({
          conversationId: conversationId,
          sender: sender,
          receiver: receiver,
          deliveryInfo: deliveryUserIds.map((id) => ({
            userId: id,
            deliveredAt: new Date(),
          })),
          readBy: [sender],
          readInfo: [{ userId: sender, readAt: new Date() }],
          media: copiedMedia,
          ...encrypted,
          forwarded: true,
          forwardedFrom: (original.sender && /^[0-9a-fA-F]{24}$/.test(original.sender)) 
                         ? original.sender 
                         : sender,
          status: "sent"
        });
      }
    }

    const savedMessages = await Message.insertMany(messagesToInsert);
    const senderUser = await User.findById(sender)
      .select("fullName username phone")
      .lean();
    const senderLabel =
      String(
        senderUser?.fullName ||
          senderUser?.username ||
          senderUser?.phone ||
          "Ryngales",
      ).trim() || "Ryngales";
    const pushTokenCache = new Map();
    const getMediaPreviewText = (media) => {
      const list = Array.isArray(media) ? media : [];
      if (!list.length) return "";
      const firstType = String(list[0]?.type || "").toLowerCase();
      if (firstType === "image") return list.length > 1 ? "Photos" : "Photo";
      if (firstType === "video") return list.length > 1 ? "Videos" : "Video";
      if (firstType === "audio") return list.length > 1 ? "Audios" : "Audio";
      return list.length > 1 ? "Documents" : "Document";
    };

    /* =========================
       ðŸ“¡ EMITS
    ========================== */
    for (const msg of savedMessages) {
      const outgoingMsg = await materializeMessageForClient(msg);
      const previewText =
        String(outgoingMsg?.text || "").trim() ||
        getMediaPreviewText(outgoingMsg?.media);
      io.to(msg.conversationId.toString()).emit("messageReceived", outgoingMsg);
      const convMeta = targetMetaMap.get(String(msg.conversationId));
      await updateLastMessageRef({
        conversationId: msg.conversationId,
        source: convMeta?.source || "direct",
        messageId: msg._id,
      });

      const chatListPayload = {
        conversationId: msg.conversationId,
        text: previewText,
        sender: msg.sender,
        receiver: msg.receiver,
        createdAt: msg.createdAt,
      };

      const participantIds = (
        convMeta?.participants || [msg.sender, ...(Array.isArray(msg.receiver) ? msg.receiver : [msg.receiver])]
      )
        .filter(Boolean)
        .map((p) => p.toString());
      participantIds.forEach((uid) => {
        emitToUser(uid, "messageReceived", outgoingMsg);
        emitToUser(uid, "chat:list:update", chatListPayload);
      });

      const recipients = participantIds.filter(
        (uid) => String(uid) !== String(sender),
      );
      const viewers = activeConversationViewers.get(String(msg.conversationId)) || new Set();
      const groupLabel =
        String(convMeta?.groupName || "").trim() || "Group";
      const threadKey = `chat:${String(msg.conversationId)}`;
      for (const recipientId of recipients) {
        if (viewers.has(recipientId)) continue;

        const previewForNotif =
          previewText.length > 80
            ? `${previewText.slice(0, 80).trimEnd()}...`
            : previewText || "New message";
        const notification = await Notification.create({
          recipient: recipientId,
          scope: "USER",
          type: "NEW_MESSAGE",
          title: convMeta?.isGroup ? groupLabel : "New Message",
          message: convMeta?.isGroup
            ? `${senderLabel}: ${previewForNotif}`
            : previewForNotif,
          data: {
            conversationId: msg.conversationId,
            senderId: sender,
            isGroup: Boolean(convMeta?.isGroup),
            groupName: convMeta?.isGroup ? groupLabel : "",
            senderLabel,
            threadKey,
          },
          isRead: false,
        });

        emitToUser(recipientId, "newNotification", notification);
        const unreadCount = await Notification.countDocuments({
          recipient: recipientId,
          isRead: false,
        });
        emitToUser(recipientId, "unreadCount", unreadCount);

        if (!pushTokenCache.has(recipientId)) {
          const recipientUser = await User.findById(recipientId)
            .select("pushToken")
            .lean();
          pushTokenCache.set(
            recipientId,
            String(recipientUser?.pushToken || "").trim(),
          );
        }
        const recipientPushToken = pushTokenCache.get(recipientId);
        if (recipientPushToken) {
          await sendPushNotification({
            pushToken: recipientPushToken,
            title: convMeta?.isGroup ? groupLabel : `${senderLabel} • Ryngales`,
            body: convMeta?.isGroup
              ? `${senderLabel}: ${previewForNotif}`
              : previewForNotif,
            subtitle: convMeta?.isGroup ? senderLabel : undefined,
            threadKey,
            data: {
              type: "CHAT_MESSAGE",
              conversationId: msg.conversationId,
              senderId: sender,
              isGroup: Boolean(convMeta?.isGroup),
              groupName: convMeta?.isGroup ? groupLabel : "",
              senderLabel,
              threadKey,
            },
          });
        }
      }
    }

    socket.emit("forward:success", { count: savedMessages.length });

  } catch (err) {
    console.error("ðŸ”¥ CRITICAL ERROR:", err);
    socket.emit("forward:error", { message: "Internal server error" });
  }
   });


    /* =========================
       ðŸ—‘ï¸ DELETE MESSAGE(S)
    ========================== */
    socket.on("deleteMessage", async (data) => {
      try {
        const {
          sender,
          messageId,
          messageIds = [],
          conversationId,
          deleteFor = "everyone",
        } = data;

        console.log("Delete request:", data);

        if (!sender || !conversationId) {
          return socket.emit("delete:error", {
            message: "Invalid delete payload",
          });
        }

        const conversation = await resolveConversation(conversationId);
        const isParticipant = !!conversation?.participants?.some(
          (p) => p.toString() === sender.toString(),
        );

        if (!isParticipant) {
          return socket.emit("delete:error", {
            message: "You are not part of this conversation",
          });
        }

        const idsToDelete = [];
        if (messageIds.length) {
          idsToDelete.push(...messageIds);
        } else if (messageId) {
          idsToDelete.push(messageId);
        }

        const validIds = idsToDelete.filter((id) =>
          mongoose.Types.ObjectId.isValid(id),
        );

        if (!validIds.length) {
          return socket.emit("delete:error", {
            message: "No messages selected",
          });
        }

        if (deleteFor === "everyone") {
          // Sender can delete-for-everyone only their own messages.
          const ownMessageIds = (
            await Message.find(
              {
                _id: { $in: validIds },
                conversationId,
                sender,
              },
              { _id: 1 },
            ).lean()
          ).map((m) => m._id);

          if (!ownMessageIds.length) {
            return socket.emit("delete:error", {
              message: "No sender-owned messages found for delete for everyone",
            });
          }

          const result = await Message.updateMany(
            {
              _id: { $in: ownMessageIds },
            },
            {
              $set: {
                text: "This message was deleted",
                encryptedText: "",
                textIv: "",
                textAuthTag: "",
                isEncrypted: false,
                media: [],
              },
            },
          );

          io.to(conversationId.toString()).emit("messageDeleted", {
            messageIds: ownMessageIds,
            conversationId,
            deleteFor: "everyone",
            replacementText: "This message was deleted",
          });

          const latestMessageId = conversation?.lastMessage
            ? String(conversation.lastMessage)
            : null;
          const latestDeleted = latestMessageId
            ? ownMessageIds.some((id) => String(id) === latestMessageId)
            : false;
          if (latestDeleted) {
            await emitChatListPatch({
              conversationId,
              text: "This message was deleted",
              createdAt: new Date().toISOString(),
            });
          }

          socket.emit("delete:success", {
            deletedCount: result.modifiedCount,
            deleteFor: "everyone",
          });

          console.log(
            `Delete for everyone applied to ${result.modifiedCount} messages`,
          );
          return;
        }

        const hidden = await Message.updateMany(
          {
            _id: { $in: validIds },
            conversationId,
          },
          {
            $addToSet: { deletedFor: sender },
          },
        );

        socket.emit("messageDeleted", {
          messageIds: validIds,
          conversationId,
          deleteFor: "me",
        });

        socket.emit("delete:success", {
          deletedCount: hidden.modifiedCount || 0,
          deleteFor: "me",
        });

        console.log(
          `Hidden ${hidden.modifiedCount || 0} messages for user ${sender}`,
        );
      } catch (err) {
        console.error("deleteMessage error:", err);

        socket.emit("delete:error", {
          message: "Failed to delete messages",
        });
      }
    });



    /* ========================= 
       DISCONNECT 
    ========================== */
    socket.on("disconnect", () => {
      if (socket.userId) {
        const uid = String(socket.userId || "");
        // avoid deleting a newer active socket mapping for same user
        if (onlineUsers.get(uid) === socket.id) {
          onlineUsers.delete(uid);
        }
        userAppState.delete(socket.userId);
        console.log("ðŸ”´ User disconnected:", socket.userId);
      }
    });
  });
};



