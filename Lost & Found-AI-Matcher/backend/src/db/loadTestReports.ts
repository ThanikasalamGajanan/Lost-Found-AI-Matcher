/**
 * Seed script: reads test reports from a JSON file and inserts each
 * report into the database via the existing API endpoints.
 *
 * Usage:
 *   npx tsx src/db/loadTestReports.ts [path-to-json]
 *
 *   If no path is given, prompts interactively.
 *
 * Prerequisites:
 *   - Backend running on localhost:4000 (or set API_URL env var)
 *   - DATABASE_URL, SUPABASE env vars set (via .env)
 *   - OPENAI_API_KEY set (each report generates an embedding)
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { supabaseAdmin } from './supabase.js';
import { pool } from './pool.js';

// ── Types ──────────────────────────────────────
interface TestReport {
  report_id: string;
  type: 'lost' | 'found';
  language: string;
  category: string;
  brand: string | null;
  colour: string | null;
  location: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  description: string;
  match_id: string | null;
}

interface TestDataset {
  dataset: { name: string; record_count: number };
  ground_truth: {
    matched_pairs: Array<{ match_id: string; lost_report_id: string; found_report_id: string }>;
    distractors: unknown[];
  };
  reports: TestReport[];
}

// ── Config ─────────────────────────────────────
const API_URL = process.env.API_URL || `http://localhost:${config.port}/api`;
const SEED_EMAIL = 'seed@test.com';
const SEED_PASSWORD = 'SeedTest1234!';
const SEED_NAME = 'Seed Script';

// ── Helpers ────────────────────────────────────
function combine(date: string, time: string): string {
  // "2026-08-12" + "20:30" → "2026-08-12T20:30:00+05:30" (IST)
  return `${date}T${time}:00+05:30`;
}

async function apiFetch(endpoint: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(json.message as string) || JSON.stringify(json)}`);
  }

  return json;
}

/**
 * Ensure a test user exists and return a valid JWT token.
 * Creates the user in Supabase Auth if needed; the DB trigger
 * will auto-create the matching `users` row.
 */
async function ensureTestUser(): Promise<{ userId: string; token: string }> {
  // 1. Try to find existing Supabase auth user
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  let authUser = listData?.users?.find((u) => u.email === SEED_EMAIL);

  if (!authUser) {
    console.log(`  Creating test user ${SEED_EMAIL} in Supabase Auth...`);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: SEED_NAME },
    });
    if (error || !data.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }
    authUser = data.user;
    // Give the DB trigger a moment to create the users row
    await new Promise((r) => setTimeout(r, 500));
  }

  const userId = authUser.id;

  // 2. Ensure role is 'user' in the users table
  await pool.query(
    `INSERT INTO users (id, email, full_name, role)
     VALUES ($1, $2, $3, 'user')
     ON CONFLICT (id) DO NOTHING`,
    [userId, SEED_EMAIL, SEED_NAME]
  );

  // 3. Issue a JWT
  const token = jwt.sign(
    { sub: userId, role: 'user', email: SEED_EMAIL },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  return { userId, token };
}

// ── Main ───────────────────────────────────────
async function main(): Promise<void> {
  // Resolve JSON path
  const jsonPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), '..', 'lost_and_found_test_reports.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`\n  JSON file not found: ${jsonPath}`);
    console.error('  Usage: npx tsx src/db/loadTestReports.ts [path-to-json]\n');
    process.exit(1);
  }

  console.log(`\n  Loading test reports from: ${jsonPath}\n`);

  // 1. Parse JSON
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const dataset: TestDataset = JSON.parse(raw);
  const reports = dataset.reports;
  console.log(`  Found ${reports.length} reports (${dataset.dataset.name})`);

  const lostCount = reports.filter((r) => r.type === 'lost').length;
  const foundCount = reports.filter((r) => r.type === 'found').length;
  console.log(`    Lost: ${lostCount}   Found: ${foundCount}\n`);

  // 2. Get auth token
  console.log('  Authenticating test user...');
  const { userId, token } = await ensureTestUser();
  console.log(`  Using test user: ${userId}\n`);

  // 3. Submit each report via the API
  let success = 0;
  let failed = 0;
  const results: Array<{ report_id: string; type: string; db_id?: string; error?: string }> = [];

  for (const report of reports) {
    const endpoint = report.type === 'lost' ? '/reports/lost' : '/reports/found';
    const timestamp = combine(report.date, report.time);

    const body: Record<string, unknown> = {
      category: report.category,
      brand: report.brand || null,
      colour: report.colour || null,
      description: report.description,
      location: report.location,
      latitude: null,
      longitude: null,
      photo_url: null,
    };

    if (report.type === 'lost') {
      body.lost_at = timestamp;
      body.identifying_info = null;
    } else {
      body.found_at = timestamp;
      body.private_details = {};
    }

    process.stdout.write(`  [${report.report_id}] ${report.type.padEnd(5)} → ${endpoint} ... `);

    try {
      const result = await apiFetch(endpoint, token, body);
      const dbId = result.id as string | undefined;
      console.log(`OK  (${dbId?.slice(0, 8)}...)`);
      results.push({ report_id: report.report_id, type: report.type, db_id: dbId });
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL  (${msg})`);
      results.push({ report_id: report.report_id, type: report.type, error: msg });
      failed++;
    }
  }

  // 4. Summary
  console.log('\n  ──────────────────────────────────────');
  console.log(`  Done.  ${success} succeeded,  ${failed} failed`);
  console.log('  ──────────────────────────────────────\n');

  if (failed > 0) {
    console.log('  Failed reports:');
    for (const r of results.filter((r) => r.error)) {
      console.log(`    ${r.report_id}: ${r.error}`);
    }
    console.log();
  }

  // 5. Write mapping file (report_id → DB UUID) for reference
  const mappingPath = path.join(path.dirname(jsonPath), 'report_id_mapping.json');
  const mapping: Record<string, { db_id: string; type: string }> = {};
  for (const r of results) {
    if (r.db_id) {
      mapping[r.report_id] = { db_id: r.db_id, type: r.type };
    }
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`  ID mapping saved to: ${mappingPath}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('\n  Fatal error:', err);
  process.exit(1);
});
