import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

import connectDB from "./configs/db.js";
import connectCloudinary from "./configs/Cloudinary.js";

import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";

import { stripeWebhooks } from "./controllers/orderController.js";

const app = express();
const port = process.env.PORT || 3000;

// --------------------
// DB + Cloud init (safe for serverless)
// --------------------
let initPromise = null;

const ensureInitialized = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      await connectCloudinary();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

// Ensure initialization before handling requests
app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    next(err);
  }
});

// --------------------
// Stripe Webhook (RAW BODY REQUIRED)
// --------------------
app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

// --------------------
// Middlewares
// --------------------
app.use(express.json());
app.use(cookieParser());

// --------------------
// CORS CONFIG (FIXED)
// --------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(",")
    : []),
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Allow all (optional override)
    if (process.env.CORS_ALLOW_ALL === "true") {
      return callback(null, true);
    }

    // Exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow localhost in development
    if (
      process.env.NODE_ENV !== "production" &&
      (origin.includes("localhost") || origin.includes("127.0.0.1"))
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Handle preflight requests
app.options("*", cors());

// --------------------
// Routes
// --------------------
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/user", userRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/address", addressRouter);
app.use("/api/order", orderRouter);

// --------------------
// Global Error Handler
// --------------------
app.use((err, req, res, next) => {
  console.error(err?.stack || err);

  if (res.headersSent) return next(err);

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  res.status(500).json({
    success: false,
    message: err?.message || "Internal Server Error",
  });
});

// --------------------
// Start Server (only local)
// --------------------
if (!process.env.VERCEL) {
  ensureInitialized()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err?.message || err);
      process.exitCode = 1;
    });
}

export default app;