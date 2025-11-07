import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Replace with your backend IP address (not localhost)
const SOCKET_URL = "EXPO_PUBLIC_API_URL=https://conjunctival-bendy-ellsworth.ngrok-free.dev/api"; // ← Your machine’s local IP

let socket;

export const connectSocket = async () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    // Get userId from storage (if stored after login)
    const userId = await AsyncStorage.getItem("userId");
    if (userId) {
      socket.emit("register", userId);
      console.log("🟢 Registered user:", userId);
    }

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Disconnected from Socket.IO");
    });
  }
  return socket;
};

export const getSocket = () => socket;
