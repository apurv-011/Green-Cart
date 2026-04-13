import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    items: [
      {
        product: { type: String, required: true, ref: "Product" },
        quantity: { type: Number, required: true },
      },
    ],
    amount: { type: Number, required: true },
    address: { type: String, required: true, ref: "Address" },
    status: { type: String, default: "Order placed" },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
  },
  { timestamps: true },
);

const Order = mongoose.models.order || mongoose.model("order", orderSchema);

export default Order;
