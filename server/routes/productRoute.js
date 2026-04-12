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

productRouter.post("/add", upload.array(['images']), authSeller, addProducts);
productRouter.get("/list", productList);
productRouter.post("/id", productById);
productRouter.post("/stock", authSeller, changeStock);

export default productRouter;
