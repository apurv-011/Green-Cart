import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import mongoose from "mongoose";
import Product from "../models/Products.js";

const createProductError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sendProductError = (res, error) => {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? "Server error" : error.message,
  });
};

const cleanupUploadedFiles = async (files = []) => {
  await Promise.all(
    files
      .filter((file) => file.path)
      .map((file) => fs.unlink(file.path).catch(() => {}))
  );
};

const parseProductData = (rawProductData) => {
  try {
    return JSON.parse(rawProductData);
  } catch {
    throw createProductError("Invalid product data");
  }
};

const validateProductData = (productData) => {
  const name = String(productData.name || "").trim();
  const category = String(productData.category || "").trim();
  const description = Array.isArray(productData.description)
    ? productData.description.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const price = Number(productData.price);
  const offerPrice = Number(productData.offerPrice);

  if (!name || !category || description.length === 0) {
    throw createProductError("Product name, category, and description are required");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw createProductError("Product price must be greater than 0");
  }

  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw createProductError("Offer price must be greater than 0");
  }

  if (offerPrice > price) {
    throw createProductError("Offer price cannot be greater than product price");
  }

  return { name, description, category, price, offerPrice };
};

// Add product : /api/product/add
export const addProducts = async (req, res) => {
  const images = req.files || [];

  try {
    const productData = validateProductData(parseProductData(req.body.productData));

    if (images.length === 0) {
      throw createProductError("At least one product image is required");
    }

    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      }),
    );

    await Product.create({ ...productData, image: imagesUrl });

    return res.json({ success: true, message: "Product Added" });
  } catch (error) {
    console.log(error.message);
    return sendProductError(res, error);
  } finally {
    await cleanupUploadedFiles(images);
  }
};

// Get product : /api/product/list
export const productList = async (req, res) => {
  try {
    const products = await Product.find({});
    res.json({ success: true, products });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Get single product : /api/product/id
export const productById = async (req, res) => {
  try {
    const { id } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw createProductError("Valid product id is required");
    }

    const product = await Product.findById(id);

    if (!product) {
      throw createProductError("Product not found", 404);
    }

    return res.json({ success: true, product });
  } catch (error) {
    console.log(error.message);
    return sendProductError(res, error);
  }
};

// Change product inStock : /api/product/stock
export const changeStock = async (req, res) => {
  try { 
    const { id, inStock } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw createProductError("Valid product id is required");
    }

    if (typeof inStock !== "boolean") {
      throw createProductError("Stock status must be true or false");
    }

    const product = await Product.findByIdAndUpdate(id, { inStock }, { new: true });
    if (!product) {
      throw createProductError("Product not found", 404);
    }

    return res.json({ success: true, message: "Stock Updated" });
  } catch (error) {
    console.log(error.message);
    return sendProductError(res, error);
  }
};
