import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, MessageSquare, Home } from "lucide-react";

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    
    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 text-white p-4 shadow-lg">
                <div className="container mx-auto">
                    <h1 className="text-2xl font-bold text-center sm:text-left">Collaborative Workspace</h1>
                </div>
            </header>
            
            {/* Navigation */}
            <nav className="bg-slate-700 text-white shadow-md">
                <div className="container mx-auto px-4">
                    <div className="flex">
                        <button 
                            onClick={() => navigate("/")} 
                            className={`px-6 py-3 flex items-center gap-2 border-b-2 font-medium transition ${
                                currentPath === "/" 
                                    ? "border-blue-400 text-blue-400" 
                                    : "border-transparent hover:bg-slate-600"
                            }`}
                        >
                            <Home size={18} />
                            <span>Home</span>
                        </button>
                        <button 
                            onClick={() => navigate("/canvas")} 
                            className={`px-6 py-3 flex items-center gap-2 border-b-2 font-medium transition ${
                                currentPath === "/canvas" 
                                    ? "border-blue-400 text-blue-400" 
                                    : "border-transparent hover:bg-slate-600"
                            }`}
                        >
                            <Pencil size={18} />
                            <span>Canvas</span>
                        </button>
                        <button 
                            onClick={() => navigate("/chat")} 
                            className={`px-6 py-3 flex items-center gap-2 border-b-2 font-medium transition ${
                                currentPath === "/chat" 
                                    ? "border-blue-400 text-blue-400" 
                                    : "border-transparent hover:bg-slate-600"
                            }`}
                        >
                            <MessageSquare size={18} />
                            <span>Chat</span>
                        </button>
                    </div>
                </div>
            </nav>
            
            {/* Main content - Home page */}
            <main className="flex-grow bg-gray-50 p-6">
                <div className="container mx-auto">
                    <div className="bg-white rounded-lg shadow-md p-8 text-center">
                        <h2 className="text-3xl font-bold mb-6">Welcome to Collaborative Workspace</h2>
                        <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                            Collaborate with your team in real-time using our interactive whiteboard and chat features.
                        </p>
                        <div className="flex justify-center gap-4 flex-wrap">
                            <button 
                                onClick={() => navigate("/canvas")} 
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition flex items-center gap-2"
                            >
                                <Pencil size={20} />
                                Open Canvas
                            </button>
                            <button 
                                onClick={() => navigate("/chat")} 
                                className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition flex items-center gap-2"
                            >
                                <MessageSquare size={20} />
                                Open Chat
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Footer */}
            <footer className="bg-slate-800 text-white p-4">
                <div className="container mx-auto">
                    <p className="text-center text-gray-400">Collaborative Workspace © 2025</p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;