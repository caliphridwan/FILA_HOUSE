const express = require("express");
const crypto = require("crypto");
const pool = require("../../db/pool");
const { initializeTransaction, verifyTransaction } = require("../utils/paystack");

const router = express.Router();

function generateOrderRef() {
  return "ORD-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

// POST /api/orders
// body: { customerName, phone, email, address, zoneId, paymentMethod, items: [{ capId, qty }] }
// Prices are always recomputed server-side from the database — never trust client-sent totals.
router.post("/", async (req, res) => {
  const { customerName, phone, email, address, zoneId, paymentMethod, items } = req.body;

  if (!customerName || !phone || !email || !address || !zoneId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing delivery details or cart items." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let subtotal = 0;
    const lineItems = [];
    for (const item of items) {
      const { rows } = await client.query(
        "SELECT id, name, price, stock FROM caps WHERE id = $1 FOR UPDATE",
        [item.capId]
      );
      if (rows.length === 0) throw { status: 404, message: `A cap in your cart no longer exists.` };
      const cap = rows[0];
      if (item.qty < 1) throw { status: 400, message: `Invalid quantity for ${cap.name}.` };
      if (cap.stock < item.qty) throw { status: 409, message: `Only ${cap.stock} left for ${cap.name}.` };

      const lineTotal = Number(cap.price) * item.qty;
      subtotal += lineTotal;
      lineItems.push({ capId: cap.id, name: cap.name, unitPrice: cap.price, qty: item.qty, lineTotal });
    }

    const zoneRes = await client.query("SELECT id, name, price FROM delivery_zones WHERE id = $1", [zoneId]);
    if (zoneRes.rows.length === 0) throw { status: 400, message: "Invalid delivery zone." };
    const zone = zoneRes.rows[0];

    const deliveryFee = Number(zone.price);
    const total = subtotal + deliveryFee;
    const orderRef = generateOrderRef();

    const orderInsert = await client.query(
      `INSERT INTO orders
        (order_ref, customer_name, phone, email, address, zone_id, zone_name, subtotal, delivery_fee, total, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING id`,
      [orderRef, customerName, phone, email, address, zone.id, zone.name, subtotal, deliveryFee, total, paymentMethod || "card"]
    );
    const orderId = orderInsert.rows[0].id;

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, cap_id, cap_name, unit_price, qty, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, li.capId, li.name, li.unitPrice, li.qty, li.lineTotal]
      );
    }

    // Stock is deducted only once payment is confirmed (webhook), not here.
    await client.query("COMMIT");

    const callbackUrl = `${process.env.FRONTEND_URL}/order-confirmation.html`;
    const paystackData = await initializeTransaction({
      email,
      amountNaira: total,
      reference: orderRef,
      callbackUrl,
      metadata: { orderId, orderRef },
    });

    await pool.query("UPDATE orders SET paystack_reference = $1 WHERE id = $2", [orderRef, orderId]);

    res.status(201).json({
      orderId,
      orderRef,
      total,
      authorizationUrl: paystackData.authorization_url,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Could not create order. Please try again." });
  } finally {
    client.release();
  }
});

// GET /api/orders/:idOrRef — fetch an order + items (used for the receipt page)
router.get("/:idOrRef", async (req, res) => {
  const { idOrRef } = req.params;
  const isNumeric = /^\d+$/.test(idOrRef);
  try {
    const orderRes = await pool.query(
      `SELECT * FROM orders WHERE ${isNumeric ? "id = $1" : "order_ref = $1"}`,
      [idOrRef]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: "Order not found." });
    const order = orderRes.rows[0];

    const itemsRes = await pool.query("SELECT cap_name, unit_price, qty, line_total FROM order_items WHERE order_id = $1", [order.id]);
    res.json({ ...order, items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load order." });
  }
});

// GET /api/orders/verify/:reference — manual fallback if the webhook hasn't landed yet
router.get("/verify/:reference", async (req, res) => {
  try {
    const result = await verifyTransaction(req.params.reference);
    if (result.status === "success") {
      await markOrderPaidIfPending(req.params.reference);
    }
    const orderRes = await pool.query("SELECT * FROM orders WHERE order_ref = $1", [req.params.reference]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: "Order not found." });
    const order = orderRes.rows[0];
    const itemsRes = await pool.query("SELECT cap_name, unit_price, qty, line_total FROM order_items WHERE order_id = $1", [order.id]);
    res.json({ ...order, items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not verify payment." });
  }
});

// Shared helper — also used by the webhook route. Deducts stock exactly once (idempotent).
async function markOrderPaidIfPending(orderRef) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query("SELECT * FROM orders WHERE order_ref = $1 FOR UPDATE", [orderRef]);
    if (orderRes.rows.length === 0) { await client.query("ROLLBACK"); return; }
    const order = orderRes.rows[0];
    if (order.status === "paid") { await client.query("ROLLBACK"); return; }

    const items = await client.query("SELECT cap_id, qty FROM order_items WHERE order_id = $1", [order.id]);
    for (const item of items.rows) {
      if (item.cap_id) {
        await client.query("UPDATE caps SET stock = GREATEST(stock - $1, 0) WHERE id = $2", [item.qty, item.cap_id]);
      }
    }
    await client.query("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1", [order.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;
module.exports.markOrderPaidIfPending = markOrderPaidIfPending;
