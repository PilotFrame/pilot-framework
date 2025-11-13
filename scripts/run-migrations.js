#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { Pool } from 'pg';

import '../build-env.cjs';

const migrationsDir = path.join(process.cwd(), 'migrations');

function loadMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function run() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to run migrations.');
  }

  const pool = new Pool({
    connectionString: DATABASE_URL
  });

  const client = await pool.connect();
  try {
    const migrations = loadMigrations();
    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(migrationsDir, migration), 'utf-8');
      console.log(`Applying migration ${migration}...`);
      await client.query(sql);
    }
    console.log('✅ Migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

