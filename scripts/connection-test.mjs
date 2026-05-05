import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const parseDotenv = (text) => {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
};

const readClientEnv = async () => {
  const envPath = path.join(repoRoot, "client", ".env");
  const text = await fs.readFile(envPath, "utf8");
  return parseDotenv(text);
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
};

const test = async () => {
  const env = await readClientEnv().catch(() => ({}));
  const backend = (process.env.BACKEND_URL || env.VITE_BACKEND_URL || "").replace(/\/$/, "");
  const origin = (process.env.ORIGIN || "http://localhost:5173").replace(/\/$/, "");

  if (!backend) {
    console.error("Missing backend URL. Set BACKEND_URL or client/.env VITE_BACKEND_URL.");
    process.exitCode = 2;
    return;
  }

  const endpoints = [
    { name: "CORS preflight", method: "OPTIONS", path: "/api/user/is-auth" },
    { name: "Products list", method: "GET", path: "/api/product/list" },
  ];

  console.log(`Backend: ${backend}`);
  console.log(`Origin : ${origin}`);

  for (const ep of endpoints) {
    const url = `${backend}${ep.path}`;
    const headers = {
      Origin: origin,
    };

    if (ep.method === "OPTIONS") {
      headers["Access-Control-Request-Method"] = "GET";
      headers["Access-Control-Request-Headers"] = "content-type";
    }

    let res;
    try {
      res = await fetchWithTimeout(url, { method: ep.method, headers }, 15000);
    } catch (err) {
      console.log(`✗ ${ep.name}: NETWORK_ERROR (${err?.name || "Error"})`);
      continue;
    }

    const aco = res.headers.get("access-control-allow-origin");
    const acc = res.headers.get("access-control-allow-credentials");
    const status = res.status;

    let bodyPreview = "";
    if (ep.method !== "OPTIONS") {
      try {
        const text = await res.text();
        bodyPreview = text.slice(0, 200).replace(/\s+/g, " ").trim();
      } catch {
        // ignore
      }
    }

    const corsInfo = `ACO=${aco || "-"} ACC=${acc || "-"}`;
    if (status >= 200 && status < 400) {
      console.log(`✓ ${ep.name}: HTTP ${status} ${corsInfo}${bodyPreview ? ` Body: ${bodyPreview}` : ""}`);
    } else {
      console.log(`✗ ${ep.name}: HTTP ${status} ${corsInfo}${bodyPreview ? ` Body: ${bodyPreview}` : ""}`);
    }
  }
};

await test();
