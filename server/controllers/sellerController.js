import jwt from "jsonwebtoken";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";

// Login seller : /api/seller/login
export const sellerLogin = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "JWT is not configured" });
    }

    if (!process.env.SELLER_EMAIL || !process.env.SELLER_PASSWORD) {
      return res.status(500).json({ success: false, message: "Seller credentials are not configured" });
    }

    if (
      password === process.env.SELLER_PASSWORD &&
      email === process.env.SELLER_EMAIL.toLowerCase()
    ) {
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("sellerToken", token, getAuthCookieOptions());

      return res.json({ success: true, message: "Logged In" });
    } else {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Logout Seller : /api/seller/logout

export const sellerLogout = async (req, res) => {
  try {
    res.clearCookie("sellerToken", getAuthCookieOptions({ maxAge: null }));

    return res.json({ success: true, message: "Logged Out" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

