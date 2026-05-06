import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import {
  acceptCall,
  cleanupCallsOnDisconnect,
  createCall,
  endCall,
  getCallById,
  getUserCallId,
  isUserBusy,
  setCallTimeout,
  clearCallTimeout,
} from "../services/callService.js";
import { getSocketId } from "../utils/socketRegistry.js";

const norm = (v) => String(v || "").trim();
const isValidUserId = (v) => mongoose.Types.ObjectId.isValid(norm(v));

const getUserRoomSize = (io, userId) => {
  const uid = norm(userId);
  if (!uid) return 0;
  const room = io?.sockets?.adapter?.rooms?.get(`user:${uid}`);
  return room?.size || 0;
};

const isUserReachable = (io, userId) => {
  const uid = norm(userId);
  if (!uid) return false;
  if (getUserRoomSize(io, uid) > 0) return true;
  const sid = getSocketId(uid);
  if (!sid) return false;
  const socketRef = io?.sockets?.sockets?.get(sid);
  return Boolean(socketRef && !socketRef.disconnected);
};

const emitToUser = (io, userId, event, payload) => {
  const uid = norm(userId);
  if (!uid) return false;
  let emitted = false;

  // Primary path: user room (works across reconnects/socket rotations)
  if (getUserRoomSize(io, uid) > 0) {
    io.to(`user:${uid}`).emit(event, payload);
    emitted = true;
  }

  // Secondary path: direct socketId from registry map
  const sid = getSocketId(uid);
  if (sid) {
    io.to(sid).emit(event, payload);
    emitted = true;
  }
  return emitted;
};

const peerOf = (call, userId) =>
  norm(userId) === norm(call.fromUserId) ? call.toUserId : call.fromUserId;

export const registerCallHandlers = (socket, io) => {
  socket.on("callUser", async (payload = {}) => {
    const fromUserId = norm(socket.userId);
    let toUserId = norm(payload.toUserId);
    const callType = norm(payload.callType) || "audio";
    const conversationId = norm(payload.conversationId);
    const callerName = norm(payload.callerName);

    if (!fromUserId) return;
    if (!isValidUserId(fromUserId) || !isValidUserId(toUserId)) {
      socket.emit("callError", { reason: "invalidUserId", message: "Invalid caller/callee userId" });
      return;
    }
    if (fromUserId === toUserId) {
      socket.emit("callError", { reason: "selfCall", message: "Cannot call yourself" });
      return;
    }
    // Strong source of truth: for direct conversations, derive peer from DB participants.
    if (isValidUserId(conversationId)) {
      try {
        const conv = await Conversation.findById(conversationId)
          .select("participants isGroup")
          .lean();
        if (conv && !conv?.isGroup) {
          const participants = Array.isArray(conv?.participants)
            ? conv.participants.map((p) => String(p || "").trim()).filter(Boolean)
            : [];
          const resolvedPeer = participants.find(
            (p) => p !== fromUserId && isValidUserId(p),
          );
          if (resolvedPeer) {
            toUserId = resolvedPeer;
          }
        }
      } catch (_err) {
        // ignore lookup failure; normal path below.
      }
    }

    if (!isUserReachable(io, toUserId)) {
      console.log("[callUser] target not reachable", {
        fromUserId,
        toUserId,
        toUserRoomSize: getUserRoomSize(io, toUserId),
        toSocketId: getSocketId(toUserId),
      });
      socket.emit("userUnavailable", { toUserId, reason: "offline" });
      return;
    }
    if (isUserBusy(fromUserId) || isUserBusy(toUserId)) {
      socket.emit("userBusy", { toUserId, reason: "busy" });
      return;
    }

    const call = createCall({
      callId: payload.callId,
      fromUserId,
      toUserId,
      callType,
      conversationId,
    });
    if (!call) {
      socket.emit("callError", { reason: "callCreateFailed", message: "Unable to create call" });
      return;
    }

    const ringPayload = {
      callId: call.callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      callType: call.callType,
      conversationId: call.conversationId,
      callerName,
      ts: new Date().toISOString(),
    };

    emitToUser(io, toUserId, "incomingCall", ringPayload);
    socket.emit("callRinging", ringPayload);

    setCallTimeout(call.callId, (timedOutCallId) => {
      const timedOut = endCall(timedOutCallId, "timeout");
      if (!timedOut) return;
      emitToUser(io, timedOut.fromUserId, "callTimeout", {
        callId: timedOut.callId,
        fromUserId: timedOut.fromUserId,
        toUserId: timedOut.toUserId,
        reason: "noResponse",
        ts: new Date().toISOString(),
      });
      emitToUser(io, timedOut.toUserId, "endCall", {
        callId: timedOut.callId,
        reason: "timeout",
        ts: new Date().toISOString(),
      });
    });
  });

  socket.on("acceptCall", (payload = {}) => {
    const userId = norm(socket.userId);
    const callId = norm(payload.callId);
    const call = getCallById(callId);

    if (!userId || !call) return;
    if (norm(call.toUserId) !== userId) return;
    const accepted = acceptCall(callId, userId);
    if (!accepted) return;

    clearCallTimeout(callId);
    emitToUser(io, call.fromUserId, "acceptCall", {
      callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      ts: new Date().toISOString(),
    });
    emitToUser(io, call.fromUserId, "callAccepted", {
      callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      ts: new Date().toISOString(),
    });
    socket.emit("callAccepted", { callId, ts: new Date().toISOString() });
  });

  socket.on("rejectCall", (payload = {}) => {
    const userId = norm(socket.userId);
    const callId = norm(payload.callId);
    const reason = norm(payload.reason) || "rejected";
    const call = getCallById(callId);

    if (!userId || !call) return;
    if (norm(call.toUserId) !== userId) return;
    clearCallTimeout(callId);
    endCall(callId, reason);
    emitToUser(io, call.fromUserId, "rejectCall", {
      callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      reason,
      ts: new Date().toISOString(),
    });
    emitToUser(io, call.fromUserId, "callRejected", {
      callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      reason,
      ts: new Date().toISOString(),
    });
  });

  socket.on("offer", (payload = {}) => {
    const fromUserId = norm(socket.userId);
    const callId = norm(payload.callId);
    const sdp = payload.sdp;
    const call = getCallById(callId);
    if (!call || !fromUserId || !sdp) return;
    if (call.state !== "in-call") return;
    if (norm(call.fromUserId) !== fromUserId) return;
    emitToUser(io, call.toUserId, "offer", {
      callId,
      fromUserId,
      toUserId: call.toUserId,
      sdp,
      ts: new Date().toISOString(),
    });
  });

  socket.on("answer", (payload = {}) => {
    const fromUserId = norm(socket.userId);
    const callId = norm(payload.callId);
    const sdp = payload.sdp;
    const call = getCallById(callId);
    if (!call || !fromUserId || !sdp) return;
    if (call.state !== "in-call") return;
    if (norm(call.toUserId) !== fromUserId) return;
    emitToUser(io, call.fromUserId, "answer", {
      callId,
      fromUserId,
      toUserId: call.fromUserId,
      sdp,
      ts: new Date().toISOString(),
    });
  });

  socket.on("iceCandidate", (payload = {}) => {
    const fromUserId = norm(socket.userId);
    const callId = norm(payload.callId);
    const candidate = payload.candidate;
    const call = getCallById(callId);
    if (!call || !fromUserId || !candidate) return;
    if (call.state !== "in-call") return;
    if (norm(call.fromUserId) !== fromUserId && norm(call.toUserId) !== fromUserId) return;
    const toUserId = peerOf(call, fromUserId);
    emitToUser(io, toUserId, "iceCandidate", {
      callId,
      fromUserId,
      toUserId,
      candidate,
      ts: new Date().toISOString(),
    });
  });

  socket.on("endCall", (payload = {}) => {
    const userId = norm(socket.userId);
    const callId = norm(payload.callId) || norm(getUserCallId(userId));
    const reason = norm(payload.reason) || "ended";
    const call = getCallById(callId);
    if (!call || !userId) return;
    if (norm(call.fromUserId) !== userId && norm(call.toUserId) !== userId) return;
    endCall(call.callId, reason);
    const peerId = peerOf(call, userId);
    emitToUser(io, peerId, "endCall", {
      callId: call.callId,
      fromUserId: call.fromUserId,
      toUserId: call.toUserId,
      reason,
      ts: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const userId = norm(socket.userId);
    if (!userId) return;
    const ended = cleanupCallsOnDisconnect(userId);
    if (!ended) return;
    const peerId = peerOf(ended, userId);
    emitToUser(io, peerId, "endCall", {
      callId: ended.callId,
      fromUserId: ended.fromUserId,
      toUserId: ended.toUserId,
      reason: "disconnected",
      ts: new Date().toISOString(),
    });
  });
};

export default registerCallHandlers;
