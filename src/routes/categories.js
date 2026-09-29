const express = require("express");
const pool = require("../../db/pool");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// GET /api/categories — public
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM categories ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories." });
  }
});

// POST /api/categories — admin
router.post("/", adminAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Category name is required." });
  try {
    const { rows } = await pool.query(
      "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name",
      [name]
    );
    if (rows.length === 0) return res.status(409).json({ error: "That category already exists." });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add category." });
  }
});

// DELETE /api/categories/:id — admin (blocked if caps still use it)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const inUse = await pool.query("SELECT 1 FROM caps WHERE category_id = $1 LIMIT 1", [req.params.id]);
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: "Caps still use this category — remove or reassign them first." });
    }
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Category not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove category." });
  }
});

module.exports = router;
