const express = require("express");
const pool = require("../../db/pool");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// GET /api/zones — public
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, price FROM delivery_zones ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load delivery zones." });
  }
});

// POST /api/zones — admin
router.post("/", adminAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  const price = Number(req.body.price);
  if (!name || isNaN(price) || price < 0) {
    return res.status(400).json({ error: "A zone name and non-negative price are required." });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO delivery_zones (name, price) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id, name, price",
      [name, price]
    );
    if (rows.length === 0) return res.status(409).json({ error: "That zone already exists." });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add delivery zone." });
  }
});

// PUT /api/zones/:id — admin (edit name/price)
router.put("/:id", adminAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  const price = Number(req.body.price);
  if (!name || isNaN(price) || price < 0) {
    return res.status(400).json({ error: "A zone name and non-negative price are required." });
  }
  try {
    const { rows } = await pool.query(
      "UPDATE delivery_zones SET name = $1, price = $2 WHERE id = $3 RETURNING id, name, price",
      [name, price, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Zone not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update delivery zone." });
  }
});

// DELETE /api/zones/:id — admin
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM delivery_zones WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Zone not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove delivery zone." });
  }
});

module.exports = router;
