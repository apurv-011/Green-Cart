import mongoose from "mongoose";

const globalCache = globalThis.__GREEN_CART_MONGOOSE__ || {
  conn: null,
  promise: null,
  listenerAttached: false,
};
globalThis.__GREEN_CART_MONGOOSE__ = globalCache;

const connectDB = async () => {
  if (globalCache.conn) return globalCache.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  if (!globalCache.listenerAttached) {
    globalCache.listenerAttached = true;
    mongoose.connection.on("connected", () => {
      console.log("Connected to MongoDB");
    });
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err?.message || err);
    });
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || "green-cart",
      })
      .then((m) => m);
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
};

export default connectDB;
