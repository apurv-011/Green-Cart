import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import connectCloudinary from "./configs/Cloudinary.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhooks } from "./controllers/orderController.js";

const app = express();
const port = process.env.PORT || 3000;

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

// Allow multiple origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",") : []),
].filter(Boolean).map((origin) => origin.trim().replace(/\/$/, ""));

app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    return next();
  } catch (err) {
    return next(err);
  }
});

app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin?.replace(/\/$/, "");

    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/user", userRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/product", productRouter)
app.use("/api/cart", cartRouter)
app.use("/api/address", addressRouter)
app.use("/api/order", orderRouter)

app.use((err, req, res, next) => {
  // Avoid crashing serverless functions; always return a response.
  console.error(err?.stack || err);
  if (res.headersSent) return next(err);

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  return res.status(500).json({
    success: false,
    message: err?.message || "Internal Server Error",
  });
});

if (!process.env.VERCEL) {
  ensureInitialized()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err?.message || err);
      process.exitCode = 1;
    });
}

export default app;
