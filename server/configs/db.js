import mongoose from "mongoose";
import dns from "dns";

const globalCache = globalThis.__GREEN_CART_MONGOOSE__ || {
  conn: null,
  promise: null,
  listenerAttached: false,
  dnsSet: false,
};
globalThis.__GREEN_CART_MONGOOSE__ = globalCache;

const connectDB = async () => {
  if (globalCache.conn) return globalCache.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  // Optional: override DNS resolvers (useful when mongodb+srv SRV lookups fail locally)
  // Example: MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8
  if (process.env.MONGODB_DNS_SERVERS && !globalCache.dnsSet) {
    const servers = process.env.MONGODB_DNS_SERVERS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length) {
      try {
        dns.setServers(servers);
        globalCache.dnsSet = true;
      } catch {
        // ignore; not supported in some environments
      }
    }
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

  try {
    globalCache.conn = await globalCache.promise;
    return globalCache.conn;
  } catch (err) {
    const msg = err?.message || String(err);
    if (
      /querySrv/i.test(msg) &&
      (/ECONNREFUSED/i.test(msg) || /ENOTFOUND/i.test(msg) || /ETIMEOUT/i.test(msg))
    ) {
      throw new Error(
        [
          "MongoDB SRV lookup failed (mongodb+srv).",
          "Your DNS/network is refusing SRV queries.",
          "Fix: set MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8 OR use the non-SRV Atlas URI (mongodb://... with host list).",
          `Original: ${msg}`,
        ].join(" ")
      );
    }
    throw err;
  }
};

export default connectDB;
