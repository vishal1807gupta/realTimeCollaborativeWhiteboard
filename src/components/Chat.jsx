import React, { useState, useRef, useEffect } from "react";
import { socket } from "../socket";
import { useNavigate } from "react-router-dom";
import { Send, Users } from "lucide-react";

const Chat = ({ messages, username, setUsername, users }) => {
    const [newMessage, setNewMessage] = useState("");
    const [showUsers, setShowUsers] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim() === "") return;

        // Send message to server
        socket.emit("sendMessage", {
            type: "message",
            content: newMessage,
        });

        // Clear input field
        setNewMessage("");
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <>
        {username && <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">Whiteboard Chat</h1>
                <div className="flex items-center space-x-2">
                    <span>Logged in as: <strong>{username}</strong></span>
                    <button 
                        onClick={() => setShowUsers(!showUsers)}
                        className="bg-blue-500 p-2 rounded hover:bg-blue-400"
                        title="Show users"
                    >
                        <Users size={18} />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Messages area */}
                <div className="flex-1 flex flex-col p-4">
                    <div className="flex-1 overflow-y-auto mb-4 bg-white rounded shadow-md p-4">
                        {messages.length === 0 ? (
                            <p className="text-gray-500 italic text-center">No messages yet. Start the conversation!</p>
                        ) : (
                            messages.map((msg, index) => (
                                <div key={index} className="mb-3">
                                    {msg.type === "notification" ? (
                                        // Notification message
                                        <div className="bg-gray-100 p-2 rounded text-center text-gray-600">
                                            <p>{msg.content}</p>
                                            <span className="text-xs">{formatTime(msg.timestamp)}</span>
                                        </div>
                                    ) : (
                                        // User message
                                        <div className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${
                                                msg.username === username ? 'bg-blue-500 text-white' : 'bg-gray-200'
                                            }`}>
                                                {msg.username !== username && (
                                                    <p className="font-bold text-sm">{msg.username}</p>
                                                )}
                                                <p>{msg.content}</p>
                                                <p className={`text-xs text-right ${
                                                    msg.username === username ? 'text-blue-100' : 'text-gray-500'
                                                }`}>
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message input */}
                    <form onSubmit={handleSubmit} className="flex space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>

                {/* Users sidebar - conditionally shown */}
                {showUsers && (
                    <div className="w-64 bg-white border-l p-4 overflow-y-auto">
                        <h2 className="font-bold text-lg mb-2">Connected Users ({users.length})</h2>
                        <ul>
                            {users.map((user) => (
                                <li 
                                    key={user.id} 
                                    className={`p-2 rounded mb-1 ${user.username === username ? 'bg-blue-100' : ''}`}
                                >
                                    {user.username} {user.username === username && "(You)"}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-gray-200 p-3 flex justify-between">
                <button
                    onClick={() => navigate("/canvas")}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                    Back to Whiteboard
                </button>
                <span className="text-gray-600 text-sm self-center">
                    {users.length} user{users.length !== 1 ? 's' : ''} online
                </span>
            </div>
        </div>}
      </>
    );
};

export default Chat;