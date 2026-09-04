import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  
  const PORT = 3000;

  // Real-time Multiplayer Logic
  const rooms = new Map<string, any>(); // Manage game rooms

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Host creates a new room
    socket.on("createRoom", () => {
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
      rooms.set(roomId, { host: socket.id, players: [] });
      socket.join(roomId);
      socket.emit("roomCreated", roomId);
      console.log(`Room ${roomId} created by ${socket.id}`);
    });

    // Mobile controller joins a room
    socket.on("joinRoom", (roomId, playerName) => {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        if (room.players.length < 4) {
          const player = { id: socket.id, name: playerName || `Player ${room.players.length + 1}` };
          room.players.push(player);
          socket.join(roomId);
          socket.emit("joinedRoom", roomId, player);
          io.to(room.host).emit("playerJoined", player);
        } else {
          socket.emit("roomError", "Room is full");
        }
      } else {
        socket.emit("roomError", "Room not found");
      }
    });

    // Controller input events
    socket.on("slingDrag", (roomId, dragData) => {
      const room = rooms.get(roomId);
      if (room) {
        io.to(room.host).emit("slingDrag", { playerId: socket.id, ...dragData });
      }
    });

    socket.on("slingRelease", (roomId, releaseData) => {
      const room = rooms.get(roomId);
      if (room) {
        io.to(room.host).emit("slingRelease", { playerId: socket.id, ...releaseData });
      }
    });
    
    socket.on("triggerAbility", (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        io.to(room.host).emit("triggerAbility", { playerId: socket.id });
      }
    });

    socket.on("bowlAim", (roomId, data) => {
      socket.to(roomId).emit("bowlAim", data);
    });

    socket.on("bowlThrow", (roomId, data) => {
      socket.to(roomId).emit("bowlThrow", data);
    });

    socket.on("turnUpdate", (roomId, activePlayerId) => {
      const room = rooms.get(roomId);
      if (room) {
        io.to(roomId).emit("turnUpdate", activePlayerId);
      }
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      rooms.forEach((room, roomId) => {
        if (room.host === socket.id) {
          io.to(roomId).emit("hostDisconnected");
          rooms.delete(roomId);
        } else {
          const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
          if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            io.to(room.host).emit("playerLeft", player);
          }
        }
      });
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
