const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set — the API will fail on any DB query.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Render, Railway, Supabase, etc.) need SSL.
  // Set PGSSL=false in .env for local development if your local Postgres doesn't use SSL.
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] unexpected error on idle client", err);
});

module.exports = pool;
