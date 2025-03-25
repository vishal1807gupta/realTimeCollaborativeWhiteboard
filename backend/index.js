const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const cors = require("cors");
const server = http.createServer(app);

// Express (app) alone handles only HTTP requests (GET, POST, etc.).
// http.createServer(app) creates a raw HTTP server that can handle both:
// Express routes (normal API requests).
// WebSocket connections (used by socket.io).

// Express alone is NOT a server—it's just a function that handles HTTP requests.
// ✔️ app.listen(4000) automatically creates a server behind the scenes.
// ✔️ http.createServer(app) is needed when using WebSockets (socket.io) because WebSockets need access to the raw HTTP server.

app.use(cors());
// Enable CORS to allow frontend connections

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    } // Allowing backend to accept requests from my frontend
});

// Global state management
let currentShapes = [
  { id: 1, type: "square", x: 50, y: 50, size: 100, color: "blue" },
  { id: 2, type: "circle", x: 200, y: 50, size: 100, color: "red" }
];
let currentPaths = [];
let globalUndoStack = [];
let globalRedoStack = [];

// Maximum stack size to prevent memory issues
const MAX_STACK_SIZE = 50;

io.on('connection', (socket) => {
    console.log('user connected:', socket.id);
    
    // Send current state to newly connected user

    socket.on("message", (data) => {
      io.emit("message", data); // Broadcast message to all users
    });

    socket.emit('updateShapes', currentShapes);
    socket.emit('updatePaths', currentPaths);
    socket.emit('updateUndoStack', globalUndoStack);
    socket.emit('updateRedoStack', globalRedoStack);

    // Handle updates to shapes
    socket.on('updateShapes', (shapes) => {
        currentShapes = shapes;
        socket.broadcast.emit('updateShapes', shapes);
    });

    // Handle updates to paths
    socket.on('updatePaths', (paths) => {
        currentPaths = paths;
        socket.broadcast.emit('updatePaths', paths);
    });

    // Handle pushing to the undo stack
    socket.on('pushToUndoStack', (state) => {
        // Limit stack size
        if (globalUndoStack.length >= MAX_STACK_SIZE) {
            globalUndoStack.shift(); // Remove oldest state
        }
        
        globalUndoStack.push({
            shapes: [...state.shapes],
            paths: [...state.paths]
        });
        
        // Clear redo stack when a new action is performed
        globalRedoStack = [];
        
        // Broadcast updated stacks to all clients
        io.emit('updateUndoStack', globalUndoStack);
        io.emit('updateRedoStack', globalRedoStack);
    });

    // Handle undo request
    socket.on('requestUndo', () => {
        if (globalUndoStack.length === 0) return;
        
        // Get the last state from undo stack
        const prevState = globalUndoStack.pop();
        
        // Push current state to redo stack
        globalRedoStack.push({
            shapes: [...currentShapes],
            paths: [...currentPaths]
        });
        
        // Update current state
        currentShapes = prevState.shapes;
        currentPaths = prevState.paths;
        
        // Broadcast the changes to all clients
        io.emit('applyState', prevState);
        io.emit('updateUndoStack', globalUndoStack);
        io.emit('updateRedoStack', globalRedoStack);
    });

    // Handle redo request
    socket.on('requestRedo', () => {
        if (globalRedoStack.length === 0) return;
        
        // Get the last state from redo stack
        const nextState = globalRedoStack.pop();
        
        // Push current state to undo stack
        globalUndoStack.push({
            shapes: [...currentShapes],
            paths: [...currentPaths]
        });
        
        // Update current state
        currentShapes = nextState.shapes;
        currentPaths = nextState.paths;
        
        // Broadcast the changes to all clients
        io.emit('applyState', nextState);
        io.emit('updateUndoStack', globalUndoStack);
        io.emit('updateRedoStack', globalRedoStack);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// so basically app.listen(4000) also create server behind the scenes but i don't have it's instance like a object so to attach a socket.io to server i need server instance that's why http.createServer() method is used to create server instance and app is just request handler function (not a server) app.listen(4000) creates internally server

// so mainly we need express for middleware functionality and it's amazing apis like app.get,app.post