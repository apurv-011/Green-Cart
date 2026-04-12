// Add Address : /api/address/add

import Address from "../models/Address.js";

const requiredAddressFields = [
  "firstName",
  "lastName",
  "email",
  "street",
  "city",
  "state",
  "zipcode",
  "country",
  "phone",
];

const sanitizeAddress = (address) => {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    throw new Error("Address is required");
  }

  const sanitizedAddress = {};

  for (const field of requiredAddressFields) {
    const value = String(address[field] || "").trim();

    if (!value) {
      throw new Error(`${field} is required`);
    }

    sanitizedAddress[field] = value;
  }

  const zipcode = Number(sanitizedAddress.zipcode);
  if (!Number.isInteger(zipcode) || zipcode <= 0) {
    throw new Error("Valid zipcode is required");
  }

  sanitizedAddress.zipcode = zipcode;
  sanitizedAddress.email = sanitizedAddress.email.toLowerCase();

  return sanitizedAddress;
};

export const addAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { address } = req.body;
    const sanitizedAddress = sanitizeAddress(address);

    await Address.create({ ...sanitizedAddress, userId });

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
    });

  } catch (error) {
    console.log("Add address error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get addresses : /api/address/get
export const getAddress = async (req, res) => {
  try {
    const userId = req.userId;

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
