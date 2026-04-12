import express from "express";
import { upload } from "../configs/multer.js";
import {
  addProducts,
  changeStock,
  productById,
  productList,
} from "../controllers/productController.js";
import authSeller from "../middlewares/authSeller.js";

const productRouter = express.Router();

const uploadProductImages = (req, res, next) => {
  upload.array(["images"])(req, res, (error) => {
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    next();
  });
};

productRouter.post("/add", authSeller, uploadProductImages, addProducts);
productRouter.get("/list", productList);
productRouter.post("/id", productById);
productRouter.post("/stock", authSeller, changeStock);

export default productRouter;
