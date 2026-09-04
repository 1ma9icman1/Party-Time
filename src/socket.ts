import { io } from "socket.io-client";

// In development, the Vite dev server proxies to the Express server running on same port
// In production, the client and server run on the same origin
const URL = typeof window !== 'undefined' ? window.location.origin : '';

export const socket = io(URL, {
  autoConnect: true,
});
