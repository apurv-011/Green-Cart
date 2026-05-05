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
// Vercel runs behind a proxy; trust it so secure/cookie/cors behaviors are consistent.
app.set("trust proxy", 1);
const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

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

const normalizeOrigin = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    // If config is missing protocol (e.g. "myapp.vercel.app"), assume https.
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
};

const buildAllowedOrigins = () => {
  const raw = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",") : []),
  ];

  // Vercel provides domain without protocol in VERCEL_URL.
  if (process.env.VERCEL_URL) raw.push(`https://${process.env.VERCEL_URL}`);

  const origins = new Set(raw.map(normalizeOrigin).filter(Boolean));

  const hostnames = new Set();
  for (const origin of origins) {
    try {
      hostnames.add(new URL(origin).hostname);
    } catch {
      // ignore
    }
  }

  return { origins, hostnames };
};

const { origins: allowedOrigins, hostnames: allowedHostnames } = buildAllowedOrigins();

app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());
const corsOptions = {
  origin: (origin, callback) => {
    if (process.env.CORS_ALLOW_ALL === "true") {
      return callback(null, true);
    }

    // Some clients (mobile apps, curl, server-to-server) won't send an Origin header.
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return callback(new Error("Not allowed by CORS"));

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // In dev, allow any port for localhost to reduce friction.
    try {
      const { hostname } = new URL(normalizedOrigin);
      if (isDev && (hostname === "localhost" || hostname === "127.0.0.1")) {
        return callback(null, true);
      }

      // For deployments, allow exact hostname matches (useful for Vercel preview URLs).
      if (allowedHostnames.has(hostname)) {
        return callback(null, true);
      }

      // Optional escape hatch for Vercel preview URLs (use with caution).
      if (process.env.ALLOW_VERCEL_PREVIEWS === "true" && hostname.endsWith(".vercel.app")) {
        return callback(null, true);
      }
    } catch {
      // ignore
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors({
  origin: "https://green-cart-client-black.vercel.app",
  credentials: true
}));

// Express 5 (path-to-regexp v6) does not accept "*" as a path pattern.
app.options(/.*/, cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Lightweight health endpoint that does not require DB/Cloudinary.
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Initialize heavy deps lazily. Skip preflight requests so CORS works even if DB is down.
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/health") return next();

  try {
    await ensureInitialized();
    return next();
  } catch (err) {
    return next(err);
  }
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
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
