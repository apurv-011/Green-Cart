import Order from "../models/Order.js";
import Product from "../models/Products.js";
import User from "../models/User.js";
import Address from "../models/Address.js";
import stripe from "stripe";
import mongoose from "mongoose";

const TAX_RATE = 0.02;

const createClientError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const formatAmount = (amount) => Math.round(amount * 100) / 100;

const toStripeCents = (amount) => Math.round(formatAmount(amount) * 100);

const getStripeCurrency = () => (process.env.STRIPE_CURRENCY || "aud").toLowerCase();

const normalizeOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createClientError("Cart is empty");
  }

  return items.map((item) => {
    const product = String(item.product || "").trim();
    const quantity = Number(item.quantity);

    if (!mongoose.isValidObjectId(product)) {
      throw createClientError("Invalid product in cart");
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw createClientError("Invalid product quantity");
    }

    return { product, quantity };
  });
};

const prepareOrder = async ({ items, address, userId }) => {
  const normalizedItems = normalizeOrderItems(items);

  if (!mongoose.isValidObjectId(address)) {
    throw createClientError("Invalid address");
  }

  const addressDoc = await Address.findOne({ _id: address, userId });
  if (!addressDoc) {
    throw createClientError("Address not found for this user");
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.product))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  let subtotal = 0;
  const productData = normalizedItems.map((item) => {
    const product = productMap.get(item.product);

    if (!product) {
      throw createClientError("Product not found");
    }

    if (!product.inStock) {
      throw createClientError(`${product.name} is out of stock`);
    }

    subtotal += product.offerPrice * item.quantity;

    return {
      name: product.name,
      price: product.offerPrice,
      quantity: item.quantity,
    };
  });

  const tax = formatAmount(subtotal * TAX_RATE);
  const amount = formatAmount(subtotal + tax);

  return {
    amount,
    tax,
    productData,
    items: normalizedItems,
    address: addressDoc._id.toString(),
  };
};

const sendOrderError = (res, error) => {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? "Server error" : error.message,
  });
};

const buildStripeSuccessUrl = (origin) =>
  `${origin}/loader?next=my-orders&session_id={CHECKOUT_SESSION_ID}`;

// Place Order using COD: /api/order/cod
export const placeOrderCOD = async (req, res) => {
  try {
    const { items, address } = req.body;
    const userId = req.userId;

    const order = await prepareOrder({ items, address, userId });

    await Order.create({
      userId,
      items: order.items,
      amount: order.amount,
      address: order.address,
      paymentType: "COD",
    });

    return res.json({ success: true, message: "Order placed successfully" });
  } catch (error) {
    return sendOrderError(res, error);
  }
};

// Place Order using Stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
  let order;

  try {
    const { items, address } = req.body;
    const userId = req.userId;
    const origin = req.headers.origin || process.env.FRONTEND_URL;

    if (!origin) {
      throw createClientError("Frontend URL missing");
    }

    const orderData = await prepareOrder({ items, address, userId });

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe key missing");
    }

    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

    order = await Order.create({
      userId,
      items: orderData.items,
      amount: orderData.amount,
      address: orderData.address,
      paymentType: "Online",
    });

    const line_items = orderData.productData.map((item) => ({
      price_data: {
        currency: getStripeCurrency(),
        product_data: { name: item.name },
        unit_amount: toStripeCents(item.price),
      },
      quantity: item.quantity,
    }));

    if (orderData.tax > 0) {
      line_items.push({
        price_data: {
          currency: getStripeCurrency(),
          product_data: { name: "Tax" },
          unit_amount: toStripeCents(orderData.tax),
        },
        quantity: 1,
      });
    }

    const session = await stripeInstance.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: buildStripeSuccessUrl(origin),
      cancel_url: `${origin}/cart`,
      payment_intent_data: {
        metadata: {
          orderId: order._id.toString(),
          userId,
        },
      },
      metadata: {
        orderId: order._id.toString(),
        userId,
      },
    });

    await Order.findByIdAndUpdate(order._id, { stripeSessionId: session.id }).catch(() => {});
    return res.json({ success: true, url: session.url });

  } catch (error) {
    console.error("Stripe Order Error:", error);

    if (order?._id) {
      await Order.findByIdAndDelete(order._id).catch(() => {});
    }

    return sendOrderError(res, error);
  }
};

// Stripe Webhooks to Verify Payments : /stripe
export const stripeWebhooks = async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Stripe is not configured");
  }

  const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    console.log("Stripe event:", event.type);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const { orderId, userId } = session.metadata || {};

        if (!orderId || !userId) {
          console.error("Missing session metadata");
          break;
        }

        if (session.payment_status !== "paid") {
          break;
        }

        await Order.findByIdAndUpdate(orderId, {
          isPaid: true,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || null,
        });
        await User.findByIdAndUpdate(userId, { cartItems: {} });

        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        const { orderId } = session.metadata || {};

        if (orderId) {
          await Order.findByIdAndDelete(orderId);
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        const { orderId, userId } = paymentIntent.metadata;

        if (!orderId || !userId) {
          console.error("Missing metadata");
          break;
        }

        await Order.findByIdAndUpdate(orderId, {
          isPaid: true,
          stripePaymentIntentId: paymentIntent.id,
        });
        await User.findByIdAndUpdate(userId, { cartItems: {} });

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const { orderId } = paymentIntent.metadata;

        if (orderId) {
          await Order.findByIdAndDelete(orderId);
        }

        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).send("Webhook handler failed");
  }
};

// Verify Stripe checkout session after redirect (fallback when webhooks are not available)
// GET /api/order/stripe/verify?session_id=...
export const verifyStripeSession = async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || "").trim();
    const requestingUserId = req.userId;

    if (!sessionId) {
      throw createClientError("Missing session_id");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe key missing");
    }

    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw createClientError("Session not found");
    }

    const { orderId, userId } = session.metadata || {};

    if (!orderId || !userId) {
      const orderBySession = await Order.findOne({ stripeSessionId: sessionId });
      if (!orderBySession) {
        throw createClientError("Order metadata missing");
      }

      if (String(orderBySession.userId) !== String(requestingUserId)) {
        return res.status(403).json({ success: false, message: "Not allowed" });
      }

      if (session.payment_status === "paid") {
        await Order.findByIdAndUpdate(orderBySession._id, {
          isPaid: true,
          stripePaymentIntentId: session.payment_intent || null,
        });
        await User.findByIdAndUpdate(requestingUserId, { cartItems: {} });
      }

      return res.json({ success: true, paid: session.payment_status === "paid" });
    }

    if (String(userId) !== String(requestingUserId)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (session.payment_status === "paid") {
      await Order.findByIdAndUpdate(orderId, {
        isPaid: true,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
      });
      await User.findByIdAndUpdate(userId, { cartItems: {} });
    }

    return res.json({ success: true, paid: session.payment_status === "paid" });
  } catch (error) {
    return sendOrderError(res, error);
  }
};
// Get orders by User ID : /api/order/user
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Order.find({
      userId,
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log("Get orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all orders (admin/seller) : /api/order/seller
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
