const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const cors = require("cors");
const server = http.createServer(app);

app.use(cors());
// Enable CORS to allow frontend connections

// Express (app) alone handles only HTTP requests (GET, POST, etc.).
// http.createServer(app) creates a raw HTTP server that can handle both:
// Express routes (normal API requests).
// WebSocket connections (used by socket.io).

// Express alone is NOT a server—it's just a function that handles HTTP requests.
// ✔️ app.listen(4000) automatically creates a server behind the scenes.
// ✔️ http.createServer(app) is needed when using WebSockets (socket.io) because WebSockets need access to the raw HTTP server.

const io = new Server(server, {
    cors: {
        origin: "https://whiteboard-prime.netlify.app", 
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
let connectedUsers = {};

// Maximum stack size to prevent memory issues
const MAX_STACK_SIZE = 50;

// Track user join timestamps
let userJoinTimes = {};

io.on('connection', (socket) => {
    console.log('user connected:', socket.id);
    
    // Record join time
    userJoinTimes[socket.id] = new Date();
    
    socket.on('userJoined', (username) => {
        // Store user info
        connectedUsers[socket.id] = {
            id: socket.id,
            username: username,
            joinedAt: userJoinTimes[socket.id]
        };
        
        // Broadcast updated user list to all clients
        io.emit('updateUsers', Object.values(connectedUsers));
        
        // Notify all users except the one who joined
        socket.broadcast.emit('userNotification', `${username} has joined the whiteboard.`);
        
        // Welcome message just to the user who joined
        socket.emit('userNotification', `Welcome to the collaborative whiteboard, ${username}!`);
    });
    
    // Handle user left event (manual disconnect)
    socket.on('userLeft', (username) => {
        handleUserDisconnect(socket.id, username);
    });

    socket.on("message", (data) => {
        io.emit("message", data); // Broadcast message to all users
    });

    // Handle updates to shapes
    socket.on('updateShapes', (shapes) => {
        currentShapes = shapes;
        socket.broadcast.emit('updateShapes', shapes);
        socket.broadcast.emit('updatePaths', currentPaths);
    });

    // Handle updates to paths
    socket.on('updatePaths', (paths) => {
        currentPaths = paths;
        socket.broadcast.emit('updateShapes', currentShapes);
        socket.broadcast.emit('updatePaths', paths);
    });

    // Handle pushing to the undo stack
    socket.on('pushToUndoStack', (state) => {
        // Add timestamp to state
        const newState = {
            shapes: state.shapes || [...currentShapes],
            paths: state.paths || [...currentPaths],
            timestamp: new Date()
        };
        
        // Limit stack size
        if (globalUndoStack.length >= MAX_STACK_SIZE) {
            globalUndoStack.shift(); // Remove oldest state
        }
        
        // Add to global undo stack
        globalUndoStack.push(newState);
        
        // Clear redo stack when a new action is performed
        globalRedoStack = [];
        
        // Send updates to all clients with filtering based on join time
        for (const userId in connectedUsers) {
            const userSocket = io.sockets.sockets.get(userId);
            if (!userSocket) continue;
            
            const joinTime = userJoinTimes[userId];
            if (!joinTime) continue;
            
            // Filter the stacks for this specific user based on join time
            const filteredStack = globalUndoStack.filter(state => 
                state.timestamp >= joinTime
            );
            
            // Send filtered stacks to user
            userSocket.emit('updateUndoStack', filteredStack);
            userSocket.emit('updateRedoStack', globalRedoStack);
        }
    });

    // Handle undo request
    socket.on('requestUndo', () => {
        const joinTime = userJoinTimes[socket.id];
        if (!joinTime) return;
        
        // Filter the stack for this user
        const userUndoStack = globalUndoStack.filter(state => 
            state.timestamp >= joinTime
        );
        
        if (userUndoStack.length === 0) {
            // Send direct response for nothing to undo
            socket.emit('undoResponse', false);
            return;
        }
        
        // Remove the last state from the global stack
        globalUndoStack.pop();
        
        // Get previous state
        const prevState = userUndoStack[userUndoStack.length - 1] || 
                         (globalUndoStack.length > 0 ? globalUndoStack[globalUndoStack.length - 1] : null);
        
        if (!prevState) {
            // If no previous state, use initial state
            socket.emit('undoResponse', false);
            return;
        }
        
        // Add current state to redo stack
        globalRedoStack.push({
            shapes: [...currentShapes],
            paths: [...currentPaths],
            timestamp: new Date()
        });
        
        // Update current state
        currentShapes = prevState.shapes;
        currentPaths = prevState.paths;
        
        // Broadcast the changes to all clients
        io.emit('applyState', {
            shapes: currentShapes,
            paths: currentPaths
        });
        
        // Update all clients' stacks
        for (const userId in connectedUsers) {
            const userSocket = io.sockets.sockets.get(userId);
            if (!userSocket) continue;
            
            const userJoinTime = userJoinTimes[userId];
            if (!userJoinTime) continue;
            
            // Filter the stacks for this specific user
            const filteredStack = globalUndoStack.filter(state => 
                state.timestamp >= userJoinTime
            );
            
            // Send filtered stacks to user
            userSocket.emit('updateUndoStack', filteredStack);
            userSocket.emit('updateRedoStack', globalRedoStack);
        }
        
        // Send success response for undo
        socket.emit('undoResponse', true);
    });

    // Handle redo request
    socket.on('requestRedo', () => {
        if (globalRedoStack.length === 0) {
            // Send direct response for nothing to redo
            socket.emit('redoResponse', false);
            return;
        }
        
        // Get the next state from redo stack
        const nextState = globalRedoStack.pop();
        
        // Push current state to undo stack
        globalUndoStack.push({
            shapes: [...currentShapes],
            paths: [...currentPaths],
            timestamp: new Date()
        });
        
        // Update current state
        currentShapes = nextState.shapes;
        currentPaths = nextState.paths;
        
        // Broadcast the changes to all clients
        io.emit('applyState', {
            shapes: currentShapes,
            paths: currentPaths
        });
        
        // Update all clients' stacks
        for (const userId in connectedUsers) {
            const userSocket = io.sockets.sockets.get(userId);
            if (!userSocket) continue;
            
            const userJoinTime = userJoinTimes[userId];
            if (!userJoinTime) continue;
            
            // Filter the stacks for this specific user
            const filteredStack = globalUndoStack.filter(state => 
                state.timestamp >= userJoinTime
            );
            
            // Send filtered stacks to user
            userSocket.emit('updateUndoStack', filteredStack);
            userSocket.emit('updateRedoStack', globalRedoStack);
        }
        
        // Send success response for redo
        socket.emit('redoResponse', true);
    });

    socket.on('sendMessage', (message) => {
        const username = connectedUsers[socket.id]?.username || 'Anonymous';
        const messageWithUser = {
            ...message,
            username: username,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast to all clients including sender
        io.emit('message', messageWithUser);
    });

    function handleUserDisconnect(socketId, username) {
        console.log('User disconnected:', socketId);
        
        // Remove user join time
        delete userJoinTimes[socketId];
        
        // Remove user from connected users
        delete connectedUsers[socketId];
        
        // Broadcast updated user list
        io.emit('updateUsers', Object.values(connectedUsers));
        
        // Notify remaining users
        io.emit('userNotification', `${username} has left the whiteboard.`);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
        const username = connectedUsers[socket.id]?.username || 'Someone';
        handleUserDisconnect(socket.id, username);
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// so basically app.listen(4000) also create server behind the scenes but i don't have it's instance like a object so to attach a socket.io to server i need server instance that's why http.createServer() method is used to create server instance and app is just request handler function (not a server) app.listen(4000) creates internally server

// so mainly we need express for middleware functionality and it's amazing apis like app.get,app.post
