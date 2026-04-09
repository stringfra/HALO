const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl,
});

async function testDatabaseConnection() {
  if (!databaseUrl) {
    console.warn("DATABASE_URL non definita: connessione PostgreSQL non configurata.");
    return false;
  }

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("Connessione PostgreSQL attiva.");
    return true;
  } catch (error) {
    console.warn("Connessione PostgreSQL non riuscita:", error.message);
    return false;
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};
