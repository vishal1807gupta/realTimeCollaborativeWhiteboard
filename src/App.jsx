import React ,{useEffect, useState} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Canvas from "./components/Canvas";
import Chat from "./components/Chat";
import Layout from "./components/Layout";
import { socket } from "./socket";

const App = () =>{

    const [messages, setMessages] = useState([]);

    const [shapes, setShapes] = useState([
      { id: 1, type: "square", x: 50, y: 50, size: 100, color: "blue" },
      { id: 2, type: "circle", x: 200, y: 50, size: 100, color: "red" }
  ]);
    const [paths, setPaths] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    useEffect(() => {
     
      socket.on("updateShapes", (updatedShapes) => {
          setShapes(updatedShapes);
      });

      socket.on("updatePaths", (updatedPaths) => {
          setPaths(updatedPaths);
      });
      
      return () => {
          socket.off("updateShapes");
          socket.off("updatePaths");
      };
    }, []);

     useEffect(() => {
    
        socket.on("message", (newMessage) => {
          setMessages(prevMessages=>[...prevMessages,newMessage]);
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
        <Route path="/canvas" element={<Canvas shapes={shapes} setShapes={setShapes} paths={paths} setPaths={setPaths} contextMenu={contextMenu} setContextMenu={setContextMenu} undoStack={undoStack} setUndoStack={setUndoStack} redoStack={redoStack} setRedoStack={setRedoStack}/>} />
      </Routes>
    </BrowserRouter>
    )
}

export default App;