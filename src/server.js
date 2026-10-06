require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const categoriesRoute = require("./routes/categories");
const capsRoute = require("./routes/caps");
const zonesRoute = require("./routes/zones");
const ordersRoute = require("./routes/orders");
const paystackWebhookRoute = require("./routes/paystackWebhook");

const app = express();

app.use(cors());

// IMPORTANT: the Paystack webhook needs the raw request body to verify the
// signature, so it's mounted with express.raw() BEFORE the JSON parser below.
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }), paystackWebhookRoute);

app.use(express.json());

// Serve the frontend. Cap photos now live on Cloudinary, so there's no
// local /uploads folder to serve — image_url just points straight at Cloudinary.
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/categories", categoriesRoute);
app.use("/api/caps", capsRoute);
app.use("/api/zones", zonesRoute);
app.use("/api/orders", ordersRoute);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Fila House API running on http://localhost:${PORT}`);
});
