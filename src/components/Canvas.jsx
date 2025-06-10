import React, { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket";
import { Pencil, Eraser, Move, Copy, Trash, Undo, Redo, MessageSquare, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { renderToString } from "react-dom/server";

const Canvas = ({ shapes, setShapes, paths, setPaths, contextMenu, setContextMenu}) => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);  // it's like a pointer which gives reference to actually change properties of the canvas
    const [selectedShape, setSelectedShape] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 }); // dragging part
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState("move");
    const [alert, setAlert] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 1500 });
    const lastPushedStateRef = useRef(null);
    const alertTimeoutRef = useRef(null);

    // Simple function to show an alert message
    const showAlert = (message) => {
        // Clear any existing timeout
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
        }
        
        // Show the alert
        setAlert(message);
        
        // Hide it after 2 seconds
        // store the timeout ID in a ref to clear it later
        alertTimeoutRef.current = setTimeout(() => {
            setAlert(null);
        }, 2000);
    };



    const getCursorIcon = (type) => {
        const icon = type === "pencil" ? <Pencil size={24} /> : <Eraser size={24} />;
        const svgString = encodeURIComponent(renderToString(icon));
        return `data:image/svg+xml;charset=utf-8,${svgString}`;
    };

    // Check if states are different before pushing to undo stack
    const pushToUndoStack = (state) => {
        const stateStr = JSON.stringify(state);
        const lastStateStr = lastPushedStateRef.current;
        
        if (lastStateStr !== stateStr) {
            socket.emit("pushToUndoStack", state);
            lastPushedStateRef.current = stateStr;
        }
    };

    // Request undo from server
    const handleUndo = useCallback(() => {
        socket.emit("requestUndo");
    }, []);

    // Request redo from server
    const handleRedo = useCallback(() => {
        socket.emit("requestRedo");
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === "z") {
                handleUndo();
            } else if (e.ctrlKey && e.key === "y") {
                handleRedo();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleUndo, handleRedo]);

    // Socket response handlers for alerts
    useEffect(() => {
        // These are the socket event handlers
        socket.on("undoResponse", (success) => {
            if (!success) {
                showAlert("Nothing to undo");
            }
        });

        socket.on("redoResponse", (success) => {
            if (!success) {
                showAlert("Nothing to redo");
            }
        });

        return () => {
            socket.off("undoResponse");
            socket.off("redoResponse");
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const drawAllShapes = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            shapes.forEach((shape) => drawShape(ctx, shape));
            paths.forEach((path) => drawPath(ctx, path));
        };

        const drawShape = (ctx, shape) => {
            ctx.fillStyle = shape.color;
            if (shape.type === "square") {
                ctx.fillRect(shape.x, shape.y, shape.size, shape.size);
            } else if (shape.type === "circle") {
                ctx.beginPath();
                ctx.arc(shape.x + shape.size / 2, shape.y + shape.size / 2, shape.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            drawResizeHandle(ctx, shape);
        };

        const drawPath = (ctx, path) => {
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(path.points[0].x, path.points[0].y);
            path.points.forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.stroke();
        };

        const drawResizeHandle = (ctx, shape) => {
            ctx.fillStyle = "black";
            ctx.fillRect(shape.x + shape.size - 10, shape.y + shape.size - 10, 10, 10);
        };

        drawAllShapes();
    }, [shapes, paths, canvasSize]);

    const handleMouseDown = (e) => {
        if (contextMenu) setContextMenu(null);
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const currentState = { shapes, paths };

        if (mode === "draw") {
            pushToUndoStack(currentState);
            setIsDrawing(true);
            const newPaths = [...paths, { color: "black", width: 2, points: [{ x, y }] }];
            setPaths(newPaths);
            // Send the complete state including both shapes and paths
            socket.emit("updatePaths", newPaths);
            socket.emit("updateShapes", shapes); // Also send shapes to ensure consistency
            return;
        }

        if (mode === "erase") {
            pushToUndoStack(currentState);
            setIsDrawing(true);
            return;
        }

        for (let shape of shapes) {
            if (isOnResizeHandle(shape, x, y)) {
                setSelectedShape({ ...shape, isResizing: true });
                pushToUndoStack(currentState);
                return;
            } else if (isInside(shape, x, y)) {
                setSelectedShape({ ...shape, isDragging: true });
                setOffset({ x: x - shape.x, y: y - shape.y });
                pushToUndoStack(currentState);
                return;
            }
        }
    };

    const handleMouseMove = (e) => {
        if (!isDrawing && !selectedShape) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
    
        if (isDrawing) {
            if (mode === "erase") {
                // New erasing logic that handles path splitting
                const newPaths = [];
                let hasChanged = false;
                
                paths.forEach(path => {
                    // Check if this path needs to be split
                    const segments = [];
                    let currentSegment = [];
                    let eraseOccurred = false;
                    
                    // Process each point in the path
                    path.points.forEach((point, index) => {
                        if (isNearby(point, x, y, 20)) {
                            eraseOccurred = true;
                            hasChanged = true;
                            // If we have points in the current segment, finish it
                            if (currentSegment.length > 1) {
                                segments.push([...currentSegment]);
                            }
                            currentSegment = [];
                        } else {
                            currentSegment.push(point);
                            
                            // If this is the last point and we have a segment
                            if (index === path.points.length - 1 && currentSegment.length > 0) {
                                segments.push([...currentSegment]);
                            }
                        }
                    });
                    
                    // If no erasing happened, keep the original path
                    if (!eraseOccurred) {
                        newPaths.push(path);
                    } else {
                        // Add each valid segment as a new path
                        segments.forEach(segment => {
                            if (segment.length > 1) {
                                newPaths.push({
                                    ...path,
                                    points: segment
                                });
                            }
                        });
                    }
                });
                
                // Only update if something actually changed
                if (hasChanged) {
                    setPaths(newPaths);
                    // Send the complete state including both shapes and paths
                    socket.emit("updatePaths", newPaths);
                    socket.emit("updateShapes", shapes); // Also send shapes to ensure consistency
                }
                return;
            }
            
            const newPaths = [...paths];
            newPaths[newPaths.length - 1].points.push({ x, y });
            setPaths(newPaths);
            // Send the complete state including both shapes and paths
            socket.emit("updatePaths", newPaths);
            socket.emit("updateShapes", shapes);
            return; // Also send shapes to ensure consistency
        }
    
        if (selectedShape) {
            let updatedShapes = shapes.map((shape) => {
                if (shape.id === selectedShape.id) {
                    if (selectedShape.isResizing) {
                        return { ...shape, size: Math.max(20, x - shape.x, y - shape.y) };
                    } else if (selectedShape.isDragging) {
                        return { ...shape, x: x - offset.x, y: y - offset.y };
                    }
                }
                return shape;
            });
    
            setShapes(updatedShapes);
            // Send the complete state including both shapes and paths
            socket.emit("updateShapes", updatedShapes);
            socket.emit("updatePaths", paths); // Also send paths to ensure consistency
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        setSelectedShape(null);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let shape of shapes) {
            if (isInside(shape, x, y)) {
                setContextMenu({ x: e.clientX, y: e.clientY, shape });
                return;
            }
        }
    };

    const duplicateShape = (shape) => {
        pushToUndoStack({ shapes, paths });
        const newShape = { ...shape, id: Date.now(), x: shape.x + 20, y: shape.y + 20 };
        const updatedShapes = [...shapes, newShape];
        setShapes(updatedShapes);
        // Send the complete state including both shapes and paths
        socket.emit("updateShapes", updatedShapes);
        socket.emit("updatePaths", paths); // Also send paths to ensure consistency
        setContextMenu(null);
    };

    const deleteShape = (shape) => {
        const remainingSquares = shapes.filter(s => s.type === "square").length;
        const remainingCircles = shapes.filter(s => s.type === "circle").length;

        if ((shape.type === "square" && remainingSquares === 1) || (shape.type === "circle" && remainingCircles === 1)) {
            showAlert("Cannot delete the last " + shape.type);
            setContextMenu(null);
            return; // Prevent deleting the last one
        }
        pushToUndoStack({ shapes, paths });
        const updatedShapes = shapes.filter((s) => s.id !== shape.id);
        setShapes(updatedShapes);
        // Send the complete state including both shapes and paths
        socket.emit("updateShapes", updatedShapes);
        socket.emit("updatePaths", paths); // Also send paths to ensure consistency
        setContextMenu(null);
    };

    const isInside = (shape, x, y) => x >= shape.x && x <= shape.x + shape.size && y >= shape.y && y <= shape.y + shape.size;

    const isOnResizeHandle = (shape, x, y) => x >= shape.x + shape.size - 10 && x <= shape.x + shape.size && y >= shape.y + shape.size - 10 && y <= shape.y + shape.size;

    const isNearby = (point, x, y, threshold) => Math.abs(point.x - x) < threshold && Math.abs(point.y - y) < threshold;

    return (
        <div className="flex flex-col h-screen bg-gray-50 relative overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b shadow-sm p-4 flex-shrink-0">
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-xl font-bold text-gray-800">Collaborative Canvas</h1>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleUndo} 
                            className="p-2 rounded-md hover:bg-gray-100 text-gray-700 transition"
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo size={20} />
                        </button>
                        <button 
                            onClick={handleRedo} 
                            className="p-2 rounded-md hover:bg-gray-100 text-gray-700 transition"
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo size={20} />
                        </button>
                        <button 
                            onClick={() => navigate("/chat")} 
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2 ml-2"
                        >
                            <MessageSquare size={16} />
                            <span className="hidden sm:inline">Go to Chat</span>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Alert popup */}
            {alert && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center">
                    <AlertCircle size={16} className="mr-2" />
                    <span>{alert}</span>
                </div>
            )}
            
            {/* Toolbar */}
            <div className="bg-white border-b shadow-sm flex-shrink-0">
                <div className="p-2">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setMode("move")} 
                            className={`p-2 rounded-md transition flex items-center gap-1 ${
                                mode === "move" 
                                    ? "bg-blue-100 text-blue-600" 
                                    : "hover:bg-gray-100 text-gray-700"
                            }`}
                            title="Move Tool"
                        >
                            <Move size={20} />
                            <span className="hidden sm:inline">Move</span>
                        </button>
                        <button 
                            onClick={() => setMode("draw")} 
                            className={`p-2 rounded-md transition flex items-center gap-1 ${
                                mode === "draw" 
                                    ? "bg-blue-100 text-blue-600" 
                                    : "hover:bg-gray-100 text-gray-700"
                            }`}
                            title="Draw Tool"
                        >
                            <Pencil size={20} />
                            <span className="hidden sm:inline">Draw</span>
                        </button>
                        <button 
                            onClick={() => setMode("erase")} 
                            className={`p-2 rounded-md transition flex items-center gap-1 ${
                                mode === "erase" 
                                    ? "bg-blue-100 text-blue-600" 
                                    : "hover:bg-gray-100 text-gray-700"
                            }`}
                            title="Erase Tool"
                        >
                            <Eraser size={20} />
                            <span className="hidden sm:inline">Erase</span>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Main Canvas Area - Full Screen with Scrollbars */}
            <div className="flex-grow overflow-auto">
                <canvas 
                    ref={canvasRef} 
                    width={canvasSize.width} 
                    height={canvasSize.height} 
                    style={{
                        cursor:
                            mode === "draw"
                                ? `url(${getCursorIcon("pencil")}) 0 24, auto`
                                : mode === "erase"
                                    ? `url(${getCursorIcon("eraser")}) 0 24, auto`
                                    : "default",
                        backgroundColor: "#f8f9fa",
                        border: "none",
                        display: "block",
                    }}
                    onMouseDown={handleMouseDown} 
                    onMouseMove={handleMouseMove} 
                    onMouseUp={handleMouseUp} 
                    onContextMenu={handleContextMenu}
                />
            </div>
            
            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed bg-white shadow-lg rounded-md border overflow-hidden z-50" 
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button 
                        onClick={() => duplicateShape(contextMenu.shape)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                        <Copy size={16} />
                        <span>Duplicate</span>
                    </button>
                    <button 
                        onClick={() => deleteShape(contextMenu.shape)}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                        <Trash size={16} />
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Canvas;