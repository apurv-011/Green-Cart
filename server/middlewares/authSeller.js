import jwt from "jsonwebtoken";

const authSeller = async (req, res, next) => {
  const { sellerToken } = req.cookies || {};

  if (!sellerToken) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
  try {
    const decodedToken = jwt.verify(sellerToken, process.env.JWT_SECRET);

    const tokenEmail = String(decodedToken?.email || "").trim().toLowerCase();
    const sellerEmail = String(process.env.SELLER_EMAIL || "").trim().toLowerCase();

    if (tokenEmail && sellerEmail && tokenEmail === sellerEmail) {
      next();
    } else {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Token expired or invalid" });
  }
};

export default authSeller
