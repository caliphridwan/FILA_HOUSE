// One-off script: creates tables and seeds starter data.
// Run with:  npm run db:init
const fs = require("fs");
const path = require("path");
const pool = require("./pool");

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(sql);
    console.log("Database initialized: tables created and starter data seeded.");
  } catch (err) {
    console.error("Failed to initialize database:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
