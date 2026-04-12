import jwt from "jsonwebtoken";

const authSeller = async (req, res, next) => {
  const { sellerToken } = req.cookies || {};

  if (!sellerToken) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
  try {
    const decodedToken = jwt.verify(sellerToken, process.env.JWT_SECRET);

    if (decodedToken.email === process.env.SELLER_EMAIL) {
        next();
    } else {
        return res.status(401).json({success:false, message: "Not authorized"})
    }
    
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Token expired or invalid" });
  }
};

export default authSeller
