const express = require("express");
const crypto = require("crypto");
const { markOrderPaidIfPending } = require("./orders");

const router = express.Router();

// Paystack calls this after every transaction event. We verify the signature
// using the raw request body (see server.js, which mounts this route with
// express.raw() BEFORE the global JSON body parser) so it can't be spoofed.
router.post("/", async (req, res) => {
  try {
    const signature = req.header("x-paystack-signature");
    const expected = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body) // raw Buffer
      .digest("hex");

    if (signature !== expected) {
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString("utf8"));

    if (event.event === "charge.success") {
      const reference = event.data.reference;
      await markOrderPaidIfPending(reference);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("[paystack webhook] error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
