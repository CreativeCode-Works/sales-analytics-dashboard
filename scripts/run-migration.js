#!/usr/bin/env node
/**
 * Runs SQL migration against Supabase using the REST API (no direct Postgres needed).
 * Uses SUPABASE_URL + SUPABASE_KEY (service role) to execute SQL via the /rest/v1/rpc endpoint.
 * Falls back to pg + DATABASE_URL if available.
 *
 * Usage: node scripts/run-migration.js scripts/migrations/001_expanded_tables.sql
 */

const fs = require('fs');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node run-migration.js <path-to-sql-file>');
  process.exit(1);
}

async function runViaSupabaseAPI(sql) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

  console.log('Running migration via Supabase SQL API...');

  // Split SQL into individual statements (can't run multi-statement via single query on pooler)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    const fullStmt = stmt.endsWith(';') ? stmt : stmt + ';';
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: fullStmt }),
      });
      // RPC endpoint may not exist, fall through to pg
      if (res.status === 404) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

async function runViaPg(sql) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('No DATABASE_URL available');
    return false;
  }

  const pg = require('pg');
  console.log('Running migration via direct Postgres...');

  // Split into individual statements for transaction pooler compatibility
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const stmt of statements) {
      await client.query(stmt);
    }
    return true;
  } finally {
    await client.end();
  }
}

async function runViaSupabaseManagement(sql) {
  // Use the Supabase Management API to run SQL
  // This uses the service role key against the project's SQL endpoint
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;

  // Extract project ref from URL (e.g., xihxpbybegwkupdrskio from https://xihxpbybegwkupdrskio.supabase.co)
  const match = SUPABASE_URL.match(/https:\/\/([^.]+)/);
  if (!match) return false;

  console.log('Running migration via Supabase pg endpoint...');

  // Split into statements and run individually
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Try using supabase.rpc to call a helper function, or fall back
  // Actually, we can use the Supabase postgres endpoint directly
  for (const stmt of statements) {
    const fullStmt = stmt.endsWith(';') ? stmt : stmt + ';';
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: fullStmt }),
    });

    if (res.status === 404 || res.status === 405) {
      // Endpoint doesn't exist on this Supabase version
      return false;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SQL error: ${text}\nStatement: ${fullStmt.substring(0, 100)}`);
    }
  }
  return true;
}

async function run() {
  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf-8');
  console.log(`Running migration: ${sqlFile}`);
  console.log(`SQL length: ${sql.length} chars, ~${sql.split(/;\s*\n/).filter(s => s.trim()).length} statements`);

  // Try methods in order
  let success = false;

  // Method 1: Direct pg connection
  if (!success && process.env.DATABASE_URL) {
    try {
      success = await runViaPg(sql);
      if (success) console.log('Migration completed successfully via pg.');
    } catch (err) {
      console.warn(`pg method failed: ${err.message}`);
    }
  }

  // Method 2: Supabase management endpoint
  if (!success) {
    try {
      success = await runViaSupabaseManagement(sql);
      if (success) console.log('Migration completed successfully via Supabase API.');
    } catch (err) {
      console.warn(`Supabase API method failed: ${err.message}`);
    }
  }

  if (!success) {
    console.error('\nAll migration methods failed.');
    console.error('Please run the SQL manually in Supabase Dashboard → SQL Editor.');
    console.error(`File: ${sqlFile}`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
