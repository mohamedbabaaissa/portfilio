import pg from 'pg';

// Neon (added from the Vercel Marketplace) sets DATABASE_URL for you.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// One small connection per serverless instance is enough.
export const pool = new pg.Pool({ connectionString, max: 1, idleTimeoutMillis: 10_000 });

export const query = (text, params = []) => pool.query(text, params);

async function setup() {
  await query(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      github TEXT NOT NULL DEFAULT '',
      linkedin TEXT NOT NULL DEFAULT '',
      photo TEXT NOT NULL DEFAULT ''
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  // Uploaded photos live in the database, because Vercel has no permanent disk.
  await query(`
    CREATE TABLE IF NOT EXISTS images (
      name TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      data BYTEA NOT NULL
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      locked_until BIGINT NOT NULL DEFAULT 0
    )`);

  // First run only: fill the site with sample content. Edit it from the admin.
  const first = await query(
    "INSERT INTO profile (id, name, title, email) VALUES (1, 'Your Name', 'Web Developer', 'you@example.com') ON CONFLICT (id) DO NOTHING"
  );
  if (first.rowCount === 1) {
    const day = 24 * 60 * 60 * 1000;
    const samples = [
      ['Recipe Finder', 'Search recipes by ingredient and save favourites to a list.', 'React, API', 15],
      ['Task Board API', 'A REST API for boards, lists and cards, with token login.', 'Node.js, Express', 11],
      ['Weather Now', 'A tiny forecast app that shows the next 24 hours for any city.', 'API, JavaScript', 4],
      ['Storefront Redesign', 'A faster, mobile-first rebuild of a small shop website with a simple checkout flow.', 'HTML, CSS, JavaScript', 0],
    ];
    for (const [title, description, tags, daysAgo] of samples) {
      await query('INSERT INTO projects (title, description, tags, created_at) VALUES ($1, $2, $3, $4)', [
        title,
        description,
        tags,
        new Date(Date.now() - daysAgo * day),
      ]);
    }
  }
}

let ready;
// Creates the tables once per server start. Safe to call on every request.
export function init() {
  if (!connectionString) {
    return Promise.reject(new Error('DATABASE_URL is not set.'));
  }
  ready ??= setup().catch((err) => {
    ready = undefined; // try again on the next request
    throw err;
  });
  return ready;
}
