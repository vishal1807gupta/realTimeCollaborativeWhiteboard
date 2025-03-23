import React, { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket";
import { Pencil, Eraser, Move, Copy, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { renderToString } from "react-dom/server";

const Canvas = ({ shapes, setShapes, paths, setPaths, contextMenu, setContextMenu, undoStack, setUndoStack, redoStack, setRedoStack }) => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [selectedShape, setSelectedShape] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState("move");

    const getCursorIcon = (type) => {
        const icon = type === "pencil" ? <Pencil size={24} /> : <Eraser size={24} />;
        const svgString = encodeURIComponent(renderToString(icon));
        return `data:image/svg+xml;charset=utf-8,${svgString}`;
    };

    const pushToUndoStack = (state) => {
        setUndoStack((prev) => [...prev, state]);
        setRedoStack([]); // Clear redo stack when a new action is performed
    };

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const prevState = undoStack[undoStack.length - 1];
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, { shapes, paths }]);
        setShapes(prevState.shapes);
        setPaths(prevState.paths);
        socket.emit("updateShapes", prevState.shapes);
        socket.emit("updatePaths", prevState.paths);
    }, [undoStack, shapes, paths]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, { shapes, paths }]);
        setShapes(nextState.shapes);
        setPaths(nextState.paths);
        socket.emit("updateShapes", nextState.shapes);
        socket.emit("updatePaths", nextState.paths);
    }, [redoStack, shapes, paths]);

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
    }, [shapes, paths]);

    const handleMouseDown = (e) => {
        if (contextMenu) setContextMenu(null);
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (mode === "draw") {
            pushToUndoStack({ shapes, paths });
            setIsDrawing(true);
            const prevPaths = [...paths, { color: "black", width: 2, points: [{ x, y }] }];
            setPaths(prevPaths);
            socket.emit("updatePaths", prevPaths);
            return;
        }

        if (mode === "erase") {
            pushToUndoStack({ shapes, paths });
            setIsDrawing(true);
            return;
        }

        for (let shape of shapes) {
            if (isOnResizeHandle(shape, x, y)) {
                setSelectedShape({ ...shape, isResizing: true });
                pushToUndoStack({ shapes, paths });
                return;
            } else if (isInside(shape, x, y)) {
                setSelectedShape({ ...shape, isDragging: true });
                setOffset({ x: x - shape.x, y: y - shape.y });
                pushToUndoStack({ shapes, paths });
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
                const prevPaths = [];
                for (let path of paths) {
                    const points = path.points.filter((point) => !isNearby(point, x, y, 40));
                    if (points.length > 0) prevPaths.push({ ...path, points });
                }
                setPaths(prevPaths);
                socket.emit("updatePaths", prevPaths);
                return;
            }
            const newPaths = [...paths];
            newPaths[newPaths.length - 1].points.push({ x, y });
            setPaths(newPaths);
            socket.emit("updatePaths", newPaths);
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
            socket.emit("updateShapes", updatedShapes);
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
        setShapes([...shapes, newShape]);
        socket.emit("updateShapes", [...shapes, newShape]);
        setContextMenu(null);
    };

    const deleteShape = (shape) => {
        pushToUndoStack({ shapes, paths });
        const remainingSquares = shapes.filter(s => s.type === "square").length;
        const remainingCircles = shapes.filter(s => s.type === "circle").length;

        if ((shape.type === "square" && remainingSquares === 1) || (shape.type === "circle" && remainingCircles === 1)) {
            return; // Prevent deleting the last one
        }

        const newShapes = shapes.filter((s) => s.id !== shape.id);
        setShapes(newShapes);
        socket.emit("updateShapes", newShapes);
        setContextMenu(null);
    };

    const isInside = (shape, x, y) => x >= shape.x && x <= shape.x + shape.size && y >= shape.y && y <= shape.y + shape.size;

    const isOnResizeHandle = (shape, x, y) => x >= shape.x + shape.size - 10 && x <= shape.x + shape.size && y >= shape.y + shape.size - 10 && y <= shape.y + shape.size;

    const isNearby = (point, x, y, threshold) => Math.abs(point.x - x) < threshold && Math.abs(point.y - y) < threshold;

    return (
        <>
            <div className="flex gap-4 p-4">
                <button onClick={() => setMode("move")} className={mode === "move" ? "text-blue-500" : "text-gray-500"}><Move /></button>
                <button onClick={() => setMode("draw")} className={mode === "draw" ? "text-blue-500" : "text-gray-500"}><Pencil /></button>
                <button onClick={() => setMode("erase")} className={mode === "erase" ? "text-blue-500" : "text-gray-500"}><Eraser /></button>
            </div>
            <canvas 
                ref={canvasRef} 
                width={500} 
                height={500} 
                style={{
                    cursor:
                        mode === "draw"
                            ? `url(${getCursorIcon("pencil")}) 0 24, auto`
                            : mode === "erase"
                                ? `url(${getCursorIcon("eraser")}) 0 24, auto`
                                : "default",
                }}
                className="border-2 border-black" 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp} 
                onContextMenu={handleContextMenu}
            />
            {contextMenu && (
                <div className="absolute bg-white shadow-md p-2" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <button onClick={() => duplicateShape(contextMenu.shape)}><Copy /> Duplicate</button>
                    <button onClick={() => deleteShape(contextMenu.shape)}><Trash /> Delete</button>
                </div>
            )}
            <button onClick={() => navigate("/chat")} className="border-2 border-black bg-green-600 text-white">
                Chat
            </button> 
        </>
    );
};

export default Canvas;
