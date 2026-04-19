import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Extract base domain without /api if present
const SERVER_URL = BASE_URL.replace(/\/api\/?$/, "");

let socket;

export const initSocket = () => {
  if (!socket) {
    socket = io(SERVER_URL, {
      withCredentials: true,
      autoConnect: true,
    });
    
    socket.on("connect", () => {
      console.log("Connected to socket server with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) return initSocket();
  return socket;
};

export const joinRoom = (roomName) => {
  const s = getSocket();
  s.emit("join-room", roomName);
};

export const leaveRoom = (roomName) => {
  const s = getSocket();
  if (s) s.emit("leave-room", roomName);
};
