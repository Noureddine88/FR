import express from "express";
import cors from "cors";

// Routes (example - adjust paths to your project)
import authRoutes from "./routes/auth.js";

export const app = express();

/* =======================
   CORS CONFIG (IMPORTANT)
======================= */
app.use(cors({
  origin: "https://fouratilog.netlify.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Handle preflight requests
app.options("*", cors());

/* =======================
   MIDDLEWARES
======================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================
   ROUTES
======================= */
app.use("/auth", authRoutes);

// test route
app.get("/", (req, res) => {
  res.json({ message: "API is running 🚀" });
});
