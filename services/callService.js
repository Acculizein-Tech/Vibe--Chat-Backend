import crypto from "crypto";

const CALL_TIMEOUT_MS = 30_000;

const calls = new Map(); // callId -> call record
export const ongoingCalls = new Map(); // userId -> callId
export const callStatus = new Map(); // userId -> idle | ringing | in-call
const callTimeouts = new Map(); // callId -> timeout ref

const norm = (v) => String(v || "").trim();

const newCallId = () => `call_${crypto.randomUUID()}`;

const setStatus = (userId, status) => {
  const uid = norm(userId);
  if (!uid) return;
  callStatus.set(uid, status);
};

const clearStatusIfNoCall = (userId) => {
  const uid = norm(userId);
  if (!uid) return;
  if (!ongoingCalls.get(uid)) callStatus.set(uid, "idle");
};

export const getCallById = (callId) => calls.get(norm(callId)) || null;

export const getUserCallId = (userId) => ongoingCalls.get(norm(userId)) || null;

export const getUserCallStatus = (userId) => callStatus.get(norm(userId)) || "idle";

export const isUserBusy = (userId) => Boolean(getUserCallId(userId));

export const createCall = ({ fromUserId, toUserId, callType = "audio", conversationId = "", callId }) => {
  const from = norm(fromUserId);
  const to = norm(toUserId);
  if (!from || !to) return null;
  if (from === to) return null;
  if (isUserBusy(from) || isUserBusy(to)) return null;

  const cid = norm(callId) || newCallId();
  const now = Date.now();
  const call = {
    callId: cid,
    fromUserId: from,
    toUserId: to,
    callType: callType === "video" ? "video" : "audio",
    conversationId: norm(conversationId),
    state: "ringing",
    createdAt: now,
    answeredAt: null,
    endedAt: null,
  };

  calls.set(cid, call);
  ongoingCalls.set(from, cid);
  ongoingCalls.set(to, cid);
  setStatus(from, "ringing");
  setStatus(to, "ringing");
  return call;
};

export const acceptCall = (callId, userId) => {
  const call = getCallById(callId);
  if (!call) return null;
  if (norm(userId) !== call.toUserId) return null;
  if (call.state !== "ringing") return null;
  call.state = "in-call";
  call.answeredAt = Date.now();
  setStatus(call.fromUserId, "in-call");
  setStatus(call.toUserId, "in-call");
  return call;
};

export const endCall = (callId, reason = "ended") => {
  const cid = norm(callId);
  const call = getCallById(cid);
  if (!call) return null;
  clearCallTimeout(cid);
  call.state = "ended";
  call.endedAt = Date.now();
  call.endReason = reason;
  calls.delete(cid);
  ongoingCalls.delete(call.fromUserId);
  ongoingCalls.delete(call.toUserId);
  clearStatusIfNoCall(call.fromUserId);
  clearStatusIfNoCall(call.toUserId);
  return call;
};

export const setCallTimeout = (callId, handler, timeoutMs = CALL_TIMEOUT_MS) => {
  const cid = norm(callId);
  clearCallTimeout(cid);
  const ref = setTimeout(() => {
    callTimeouts.delete(cid);
    handler?.(cid);
  }, timeoutMs);
  callTimeouts.set(cid, ref);
};

export const clearCallTimeout = (callId) => {
  const cid = norm(callId);
  const ref = callTimeouts.get(cid);
  if (ref) {
    clearTimeout(ref);
    callTimeouts.delete(cid);
  }
};

export const cleanupCallsOnDisconnect = (userId) => {
  const uid = norm(userId);
  const cid = getUserCallId(uid);
  if (!cid) {
    clearStatusIfNoCall(uid);
    return null;
  }
  const call = getCallById(cid);
  if (!call) {
    ongoingCalls.delete(uid);
    clearStatusIfNoCall(uid);
    return null;
  }
  return endCall(cid, "disconnected");
};

export default {
  createCall,
  acceptCall,
  endCall,
  getCallById,
  getUserCallId,
  getUserCallStatus,
  isUserBusy,
  setCallTimeout,
  clearCallTimeout,
  cleanupCallsOnDisconnect,
};
