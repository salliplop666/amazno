const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Validar que la clave de Stripe exista al arrancar
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("FATAL ERROR: STRIPE_SECRET_KEY no está definida.");
  process.exit(1);
}

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Prisma Orders API
const ordersApi = require("./orders");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.CLIENT_URL, // Tu frontend en Render
      "https://amazon-clone-frontend-phi.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Orders API endpoints
app.use("/api", ordersApi);

// Endpoint de Stripe (Checkout Session)
app.post("/api/payment/create-checkout-session", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid items array." });
  }

  for (const item of items) {
    if (
      !item.price_data ||
      !item.price_data.unit_amount ||
      typeof item.price_data.unit_amount !== "number" ||
      item.price_data.unit_amount <= 0
    ) {
      return res.status(400).json({ error: "Invalid or negative item amount." });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/success`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint de Stripe (Payment Intent)
app.post("/api/payment/create-payment-intent", async (req, res) => {
  const { amount } = req.body;

  if (typeof amount !== "number" || isNaN(amount) || amount <= 0 || !isFinite(amount)) {
    return res.status(400).json({ error: "Invalid or negative amount." });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// IMPORTANTE: Escuchar en 0.0.0.0 para que Render detecte el puerto abierto
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});