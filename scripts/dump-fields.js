#!/usr/bin/env node
/**
 * Dumps all AC custom field definitions (ID, name, perstag, type).
 * Used to discover field IDs for mapping.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const AC_KEY = process.env.AC_KEY;
const AC_BASE = process.env.AC_BASE;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAC(path) {
  const res = await fetch(`${AC_BASE}${path}`, { headers: { 'Api-Token': AC_KEY } });
  if (!res.ok) throw new Error(`AC API ${res.status}: ${path}`);
  return res.json();
}

async function run() {
  const fields = [];
  let offset = 0;
  while (true) {
    const data = await fetchAC(`/fields?limit=100&offset=${offset}`);
    const batch = data.fields || [];
    fields.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
    await sleep(250);
  }

  console.log(`Total fields: ${fields.length}\n`);
  console.log('ID    | PERSTAG                              | TYPE         | TITLE');
  console.log('------|--------------------------------------|--------------|------');
  for (const f of fields.sort((a, b) => parseInt(a.id) - parseInt(b.id))) {
    const id = f.id.toString().padEnd(5);
    const perstag = (f.perstag || '').padEnd(36);
    const type = (f.type || '').padEnd(12);
    console.log(`${id} | ${perstag} | ${type} | ${f.title}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
