const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../../db/pool");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `cap-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed."));
    cb(null, true);
  },
});

const capSelect = `
  SELECT caps.id, caps.name, caps.price, caps.stock, caps.description,
         caps.image_url, categories.name AS category, categories.id AS category_id
  FROM caps JOIN categories ON caps.category_id = categories.id
`;

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

// POST /api/caps — admin, multipart/form-data with optional "image" file
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  const { name, category_id, price, stock, description } = req.body;
  if (!name || !category_id || price === undefined || stock === undefined) {
    return res.status(400).json({ error: "name, category_id, price and stock are required." });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO caps (name, category_id, price, stock, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), category_id, price, stock, description || "", imageUrl]
    );
    const { rows: full } = await pool.query(`${capSelect} WHERE caps.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add cap." });
  }
});

// PUT /api/caps/:id — admin, multipart/form-data, image optional (keeps old one if omitted)
router.put("/:id", adminAuth, upload.single("image"), async (req, res) => {
  const { name, category_id, price, stock, description } = req.body;
  try {
    const existing = await pool.query("SELECT image_url FROM caps WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Cap not found." });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].image_url;

    await pool.query(
      `UPDATE caps SET name=$1, category_id=$2, price=$3, stock=$4, description=$5, image_url=$6 WHERE id=$7`,
      [name, category_id, price, stock, description || "", imageUrl, req.params.id]
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
