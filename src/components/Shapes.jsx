import React, { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { Pencil, Eraser, Move } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Canvas = ({shapes,setShapes,paths,setPaths}) => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [selectedShape, setSelectedShape] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState("move"); // Modes: move, draw, erase

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const drawAllShapes = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            shapes.forEach(shape => drawShape(ctx, shape));
            paths.forEach(path => drawPath(ctx, path));
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
            path.points.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.stroke();
        };

        const drawResizeHandle = (ctx, shape) => {
            ctx.fillStyle = "black";
            ctx.fillRect(shape.x + shape.size - 10, shape.y + shape.size - 10, 10, 10);
        };

        drawAllShapes();
    }, [shapes, paths]);

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (mode === "draw") {
            setIsDrawing(true);
            const prevPaths = [...paths, { color: "black", width: 2, points: [{ x, y }] }];
            setPaths(prevPaths);
            socket.emit("updatePaths", prevPaths);
            return;
        }

        if (mode === "erase") {
            setIsDrawing(true);
            return;
        }

        for (let shape of shapes) {
            if (isOnResizeHandle(shape, x, y)) {
                setSelectedShape({ ...shape, isResizing: true });
                return;
            } else if (isInside(shape, x, y)) {
                setSelectedShape({ ...shape, isDragging: true });
                setOffset({ x: x - shape.x, y: y - shape.y });
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
                    const points = path.points.filter(point => !isNearby(point, x, y, 40)); // Increased threshold to 40
                    if (points.length > 0) prevPaths.push({ ...path, points });
                }
                setPaths(prevPaths);
                socket.emit("updatePaths", prevPaths);
                return;
            }
            const newPaths = paths;
            newPaths[newPaths.length - 1].points.push({ x, y });
            setPaths(newPaths);
            socket.emit("updatePaths", newPaths);
        }

        if (selectedShape) {
            let updatedShapes = shapes.map(shape => {
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

    const isInside = (shape, x, y) => {
        return x >= shape.x && x <= shape.x + shape.size && y >= shape.y && y <= shape.y + shape.size;
    };

    const isOnResizeHandle = (shape, x, y) => {
        return x >= shape.x + shape.size - 10 && x <= shape.x + shape.size && y >= shape.y + shape.size - 10 && y <= shape.y + shape.size;
    };

    const isNearby = (point, x, y, threshold) => {
        return Math.abs(point.x - x) < threshold && Math.abs(point.y - y) < threshold;
    };

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
                className="border-2 border-black "
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            />
            <button onClick={() => navigate("/chat")} className="border-2 border-black bg-green-600 text-white">
                Chat
            </button> 
        </>
    );
};

export default Canvas;
