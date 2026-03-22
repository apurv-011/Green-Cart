// Add Address : /api/address/add

import Address from "../models/Address.js";

export const addAddress = async (req, res) => {
  try {
    const userId = req.userId; // ✅ FIXED
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    await Address.create({ ...address, userId });

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
    });

  } catch (error) {
    console.log("Add address error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get addresses : /api/address/get
export const getAddress = async (req, res) => {
  try {
    const userId = req.userId; // ✅ FIXED

    const addresses = await Address.find({ userId });

    return res.status(200).json({
      success: true,
      addresses,
    });

  } catch (error) {
    console.log("Get address error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
