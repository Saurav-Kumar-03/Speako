import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import path from "path";

import { connectDB } from "./lib/db.js";
import cookieParser from "cookie-parser";
dotenv.config();

const app = express()
const PORT = process.env.PORT || 5001;

const __dirname = path.resolve();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true //allow frontend to send cookies
}))

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);


if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"))
    }
    );

}
app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`)
    connectDB();
})