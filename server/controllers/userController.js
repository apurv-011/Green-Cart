// Register user : /api/user/register

import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";

export const register = async (req, res) => {
  try {
    const { name, email: rawEmail, password } = req.body;
    const email = String(rawEmail || "").trim().toLowerCase();
    const trimmedName = String(name || "").trim();

    // Validate input
    if (!trimmedName || !email || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ message: "Missing required fields", success: false });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "JWT is not configured" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters", success: false });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists", success: false });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, getAuthCookieOptions());

    return res.json({
      success: true,
      user: { _id: user._id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = String(rawEmail || "").trim().toLowerCase();

    // Validate input
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "JWT is not configured" });
    }

    // Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, getAuthCookieOptions());

    // Send response
    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });

  } catch (error) {
    console.log("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Check auth : /api/user/is-auth
export const isAuth = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    console.log("isAuth error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Logout user : /api/user/logout

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", getAuthCookieOptions({ maxAge: null }));

    return res.json({ success: true, message: "Logged Out" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
