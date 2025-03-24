import { io } from "socket.io-client";

const URL = "https://realtimecollaborativewhiteboard.onrender.com/";

export const socket = io(URL);
