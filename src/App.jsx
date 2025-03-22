import React ,{useEffect, useState} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Shapes from "./components/Shapes";
import Chat from "./components/Chat";
import Layout from "./components/Layout";
import { socket } from "./socket";

const App = () =>{

    const [messages, setMessages] = useState([]);
    const storage = (localStorage.getItem("shapes")===null)?[
        { id: 1, type: "square", x: 50, y: 50, size: 100, color: "blue" },
        { id: 2, type: "circle", x: 200, y: 50, size: 100, color: "red" }
    ]:JSON.parse(localStorage.getItem("shapes"));

    const [shapes, setShapes] = useState(storage);
    const [paths, setPaths] = useState([]);

    useEffect(() => {
      const clearChatOnExit = () => {
          localStorage.removeItem("chats");
          localStorage.removeItem("shapes");
          localStorage.removeItem("paths");
      };

      window.addEventListener("beforeunload", clearChatOnExit);

      socket.on("updateShapes", (updatedShapes) => {
          setShapes(updatedShapes);
          localStorage.setItem("shapes", JSON.stringify(updatedShapes));
      });

      socket.on("updatePaths", (updatedPaths) => {
          setPaths(updatedPaths);
          localStorage.setItem("paths", JSON.stringify(updatedPaths));
      });
      
      return () => {
          window.removeEventListener("beforeunload", clearChatOnExit);
          socket.off("updateShapes");
          socket.off("updatePaths");
      };
    }, []);

     useEffect(() => {
    
        socket.on("message", (newMessage) => {
          const chats = localStorage.getItem("chats")===null?[]:JSON.parse(localStorage.getItem("chats"));
          setMessages([...chats,newMessage]);
          localStorage.setItem("chats",JSON.stringify([...chats,newMessage]));
        });
    
        return ()=>{
          socket.off("message");
        }
      }, [messages]);

    return (
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}/>
        <Route path="/chat" element={<Chat messages={messages}/>} />
        <Route path="/canvas" element={<Shapes shapes={shapes} setShapes={setShapes} paths={paths} setPaths={setPaths}/>} />
      </Routes>
    </BrowserRouter>
    )
}

export default App;