const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Express (app) alone handles only HTTP requests (GET, POST, etc.).
// http.createServer(app) creates a raw HTTP server that can handle both:
// Express routes (normal API requests).
// WebSocket connections (used by socket.io).

// Express alone is NOT a server—it's just a function that handles HTTP requests.
// ✔️ app.listen(4000) automatically creates a server behind the scenes.
// ✔️ http.createServer(app) is needed when using WebSockets (socket.io) because WebSockets need access to the raw HTTP server.

const server = http.createServer(app);

// Enable CORS to allow frontend connections
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite frontend URL
    methods: ["GET", "POST"]
  } // Allowing backend to accept requests from my frontend
});

// Handle WebSocket connections
io.on("connection", (socket) => {
    // console.log(socket);
  console.log("User connected:", socket.id);

  // Listen for messages from frontend
  socket.on("message", (data) => {
    console.log("Message received:", data);
    io.emit("message", data); // Broadcast message to all users
  });

  socket.on("updateShapes", (data) => {
    console.log("Message received:", data);
    io.emit("updateShapes", data); // Broadcast message to all users
  });

  socket.on("updatePaths", (data) => {
    console.log("Message received:", data);
    io.emit("updatePaths", data); // Broadcast message to all users
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server
const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// so basically app.listen(4000) also create server behind the scenes but i don't have it's instance like a object so to attach a socket.io to server i need server instance that's why http.createServer() method is used to create server instance and app is just request handler function (not a server) app.listen(4000) creates internally server

// so mainly we need express for middleware functionality and it's amazing apis like app.get,app.post
