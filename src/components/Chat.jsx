import React, { useState } from "react";
import { socket } from "../socket"; // Import the socket instance
import { useNavigate } from "react-router-dom";

const Chat = ({messages}) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  
  const sendMessage = () => {
    socket.emit("message", message); // Send message to server
    setMessage(""); // Clear input
  };

  return (
    <>
    <div>
      <h2>Chat App</h2>
      <div>
        {messages.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send</button>
      </div>
      <button onClick={() => navigate("/canvas")} className="border-2 border-black bg-red-600 text-white">
        Canvas
    </button> 
  </>
  );
}

export default Chat;
