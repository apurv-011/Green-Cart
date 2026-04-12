import User from "../models/User.js";
import Product from "../models/Products.js";
import mongoose from "mongoose";

const sanitizeCartItems = async (cartItems) => {
  if (!cartItems || typeof cartItems !== "object" || Array.isArray(cartItems)) {
    return {};
  }

  const entries = Object.entries(cartItems);
  const sanitizedItems = {};

  for (const [productId, quantity] of entries) {
    const cleanProductId = String(productId).trim();
    const cleanQuantity = Number(quantity);

    if (!mongoose.isValidObjectId(cleanProductId)) {
      continue;
    }

    if (!Number.isInteger(cleanQuantity) || cleanQuantity < 1) {
      continue;
    }

    sanitizedItems[cleanProductId] = Math.min(cleanQuantity, 99);
  }

  const productIds = Object.keys(sanitizedItems);
  if (productIds.length === 0) {
    return {};
  }

  const validProducts = await Product.find({ _id: { $in: productIds }, inStock: true }).select("_id");
  const validProductIds = new Set(validProducts.map((product) => product._id.toString()));

  for (const productId of productIds) {
    if (!validProductIds.has(productId)) {
      delete sanitizedItems[productId];
    }
  }

  return sanitizedItems;
};

// Update User Cartdata : /api/cart/update
export const updateCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { cartItems } = req.body;
    const sanitizedCartItems = await sanitizeCartItems(cartItems);

    const user = await User.findByIdAndUpdate(
      userId,
      { cartItems: sanitizedCartItems },
      { new: true }
    );

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      cartItems: user.cartItems,
    });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
