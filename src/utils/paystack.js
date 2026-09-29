const axios = require("axios");

const paystackClient = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

// Starts a transaction and returns a hosted checkout URL for the customer.
// amountNaira is converted to kobo (Paystack's base unit) here.
async function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  const { data } = await paystackClient.post("/transaction/initialize", {
    email,
    amount: Math.round(amountNaira * 100),
    reference,
    callback_url: callbackUrl,
    metadata,
  });
  return data.data; // { authorization_url, access_code, reference }
}

// Confirms a transaction's real status directly with Paystack (used by the
// webhook and as a manual fallback if the webhook is delayed).
async function verifyTransaction(reference) {
  const { data } = await paystackClient.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data.data; // { status: 'success' | 'failed' | ..., amount, reference, ... }
}

module.exports = { initializeTransaction, verifyTransaction };
