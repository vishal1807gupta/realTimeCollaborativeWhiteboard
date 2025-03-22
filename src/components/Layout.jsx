import React from "react";
import { useNavigate } from "react-router-dom";

const Layout = ()=>{
    const navigate = useNavigate();
    
    return (
        <div>
            <button onClick={() => navigate("/chat")} className="border-2 border-black bg-green-600 text-white">
                Chat
            </button>
            <button onClick={() => navigate("/canvas")} className="border-2 border-black bg-red-600 text-white">
                Canvas
            </button>
        </div>
    )
}

export default Layout;