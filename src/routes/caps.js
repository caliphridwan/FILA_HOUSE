const express = require("express");
const pool = require("../../db/pool");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const capSelect = `
  SELECT caps.id, caps.name, caps.price, caps.stock, caps.description,
         caps.image_url, categories.name AS category, categories.id AS category_id
  FROM caps JOIN categories ON caps.category_id = categories.id
`;

// A Cloudinary (or any https) image URL — kept loose on purpose so any
// Cloudinary delivery URL format works, just sanity-checks it's a real https link.
function isValidImageUrl(url) {
  if (!url) return true; // image is optional
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// GET /api/caps?category=Atiku&search=royal — public
router.get("/", async (req, res) => {
  const { category, search } = req.query;
  const conditions = [];
  const params = [];

  if (category && category !== "All") {
    params.push(category);
    conditions.push(`categories.name = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`caps.name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const { rows } = await pool.query(`${capSelect} ${where} ORDER BY caps.created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load caps." });
  }
});

// POST /api/caps — admin, JSON body. image_url is a Cloudinary link pasted in the admin panel.
router.post("/", adminAuth, async (req, res) => {
  const { name, category_id, price, stock, description, image_url } = req.body;
  if (!name || !category_id || price === undefined || stock === undefined) {
    return res.status(400).json({ error: "name, category_id, price and stock are required." });
  }
  if (!isValidImageUrl(image_url)) {
    return res.status(400).json({ error: "Image URL must be a valid https link (e.g. your Cloudinary URL)." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO caps (name, category_id, price, stock, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), category_id, price, stock, description || "", image_url || null]
    );
    const { rows: full } = await pool.query(`${capSelect} WHERE caps.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add cap." });
  }
});

// PUT /api/caps/:id — admin, JSON body. Omit image_url to keep the existing photo.
router.put("/:id", adminAuth, async (req, res) => {
  const { name, category_id, price, stock, description, image_url } = req.body;
  if (!isValidImageUrl(image_url)) {
    return res.status(400).json({ error: "Image URL must be a valid https link (e.g. your Cloudinary URL)." });
  }
  try {
    const existing = await pool.query("SELECT image_url FROM caps WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Cap not found." });

    const nextImageUrl = image_url !== undefined ? image_url : existing.rows[0].image_url;

    await pool.query(
      `UPDATE caps SET name=$1, category_id=$2, price=$3, stock=$4, description=$5, image_url=$6 WHERE id=$7`,
      [name, category_id, price, stock, description || "", nextImageUrl, req.params.id]
    );
    const { rows: full } = await pool.query(`${capSelect} WHERE caps.id = $1`, [req.params.id]);
    res.json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update cap." });
  }
});

// DELETE /api/caps/:id — admin
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM caps WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Cap not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove cap." });
  }
});

module.exports = router;
