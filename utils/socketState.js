// utils/socketState.js

export const onlineUsers = new Map(); 
// userId -> socketId

export const activeConversationUsers = new Map(); 
// conversationId -> Set(userIds) [joined room]

export const activeConversationViewers = new Map(); 
// conversationId -> Set(userIds) [chat open]
export const userAppState = new Map();
