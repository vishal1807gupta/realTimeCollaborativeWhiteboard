import React, {useEffect, useState} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Canvas from "./components/Canvas";
import Chat from "./components/Chat";
import Layout from "./components/Layout";
import { socket } from "./socket";

const App = () => {
    const [messages, setMessages] = useState([]);
    const [shapes, setShapes] = useState([
        { id: 1, type: "square", x: 50, y: 50, size: 100, color: "blue" },
        { id: 2, type: "circle", x: 200, y: 50, size: 100, color: "red" }
    ]);
    const [paths, setPaths] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [username, setUsername] = useState(null);
    const [users, setUsers] = useState([]);
    let hasPrompted = false;
    
    // Prompt for username on initial mount
    useEffect(() => {
        // Check if we need to ask for a name
        if (!username && !hasPrompted) {
            // Simple prompt without loops
            const name = prompt("Please enter your name to join");
            
            if (name && name.trim()) {
                setUsername(name.trim());
                hasPrompted=true;
            }
        }
    }, []);
    
    // Set up socket listeners and user join
    useEffect(() => {
        // Set up all socket event listeners
        socket.on("updateShapes", (updatedShapes) => setShapes(updatedShapes));
        socket.on("updatePaths", (updatedPaths) => setPaths(updatedPaths));
        socket.on("updateUndoStack", (newUndoStack) => setUndoStack(newUndoStack));
        socket.on("updateRedoStack", (newRedoStack) => setRedoStack(newRedoStack));
        socket.on("applyState", (state) => {
            setShapes(state.shapes);
            setPaths(state.paths);
        });
        socket.on("updateUsers", (updatedUsers) => setUsers(updatedUsers));
        socket.on("userNotification", (notification) => {
            setMessages(prevMessages => [...prevMessages, {
                type: "notification",
                content: notification,
                timestamp: new Date().toISOString()
            }]);
        });
        socket.on("message", (newMessage) => {
            setMessages(prevMessages => [...prevMessages, newMessage]);
        });
        
        // Clean up on unmount
        return () => {
            socket.off("updateShapes");
            socket.off("updatePaths");
            socket.off("updateUndoStack");
            socket.off("updateRedoStack");
            socket.off("applyState");
            socket.off("updateUsers");
            socket.off("userNotification");
            socket.off("message");
        };
    }, []);
    
    // Handle username changes and emit join/leave events
    useEffect(() => {
        if (username) {
            // Emit userJoined event when username is set
            socket.emit("userJoined", username);
            
            // Clean up function for when username changes or component unmounts
            return () => {
                socket.emit("userLeft", username);
            };
        }
    }, [username]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}/>
                <Route path="/chat" element={
                    <Chat 
                        messages={messages} 
                        username={username} 
                        setUsername={setUsername} 
                        users={users}
                    />
                } />
                <Route path="/canvas" element={
                    <Canvas 
                        shapes={shapes} 
                        setShapes={setShapes} 
                        paths={paths} 
                        setPaths={setPaths} 
                        contextMenu={contextMenu} 
                        setContextMenu={setContextMenu}
                    />
                } />
            </Routes>
        </BrowserRouter>
    );
};

export default App;