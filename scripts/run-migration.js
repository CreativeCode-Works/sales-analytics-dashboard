#!/usr/bin/env node
/**
 * Runs SQL migration files against Supabase Postgres.
 * Usage: node scripts/run-migration.js scripts/migrations/001_expanded_tables.sql
 */

const fs = require('fs');
const path = require('path');
const pg = require('pg');

try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL env var');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node run-migration.js <path-to-sql-file>');
  process.exit(1);
}

async function run() {
  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf-8');
  console.log(`Running migration: ${sqlFile}`);

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(sql);
    console.log('Migration completed successfully.');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
