// PostgreSQL connection using 'pg' for Railway
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('railway.app') ? { rejectUnauthorized: false } : false
});

export async function getDb() {
  return pool;
}
