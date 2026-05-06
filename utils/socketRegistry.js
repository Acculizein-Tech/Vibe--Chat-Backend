import { onlineUsers } from "./socketState.js";

const normalize = (value) => String(value || "").trim();

export const getSocketId = (userId) => {
  const uid = normalize(userId);
  if (!uid) return "";
  return normalize(onlineUsers.get(uid));
};

export const isUserOnline = (userId) => Boolean(getSocketId(userId));

export const setSocketForUser = (userId, socketId) => {
  const uid = normalize(userId);
  const sid = normalize(socketId);
  if (!uid || !sid) return false;
  onlineUsers.set(uid, sid);
  return true;
};

export const removeSocketForUser = (userId, socketId) => {
  const uid = normalize(userId);
  if (!uid) return false;
  if (socketId && normalize(onlineUsers.get(uid)) !== normalize(socketId)) {
    return false;
  }
  onlineUsers.delete(uid);
  return true;
};

export default {
  getSocketId,
  isUserOnline,
  setSocketForUser,
  removeSocketForUser,
};
