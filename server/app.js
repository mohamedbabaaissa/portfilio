import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { init, query } from './db.js';

const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = process.env;
export const configError =
  !ADMIN_USERNAME || !ADMIN_PASSWORD || !JWT_SECRET || JWT_SECRET.length < 32
    ? 'Missing settings: set ADMIN_USERNAME, ADMIN_PASSWORD and a JWT_SECRET of at least 32 characters.'
    : !(process.env.DATABASE_URL || process.env.POSTGRES_URL)
      ? 'Missing setting: DATABASE_URL (your Postgres connection string).'
      : '';

const SESSION_MS = 12 * 60 * 60 * 1000; // stay logged in for 12 hours
const MAX_ATTEMPTS = 5; // wrong attempts before the lock
const LOCK_MS = 15 * 60 * 1000; // lock for 15 minutes
// Vercel limits a request to 4.5 MB, so images are capped just under that.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 does not catch errors from async handlers, so wrap them.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const app = express();

// Vercel may read the request body before Express sees it. Handle both ways:
// - body already parsed by the platform: keep it and tell express.json() to skip it
// - body parsed lazily on first access: switch that off so express.json()/multer can read it
app.use((req, res, next) => {
  try {
    const d = Object.getOwnPropertyDescriptor(req, 'body');
    if (d && 'value' in d && d.value !== undefined) {
      req._body = true; // body-parser skips requests marked as already parsed
    } else if (d && d.get) {
      Object.defineProperty(req, 'body', { value: undefined, writable: true, configurable: true, enumerable: true });
    }
  } catch {
    // plain Node: nothing to switch off
  }
  next();
});

if (process.env.VERCEL || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    referrerPolicy: { policy: 'same-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: Boolean(process.env.VERCEL || process.env.TRUST_PROXY === 'true'),
  })
);

// ---------- robots.txt and sitemap.xml (built from the address people used) ----------

const origin = (req) => `${req.protocol}://${req.get('host')}`;

app.get(['/robots.txt', '/api/robots'], (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

app.get(['/sitemap.xml', '/api/sitemap'], (req, res) => {
  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin(req)}/</loc></url>\n</urlset>\n`
    );
});

// ---------- every /api request: settings check, database ready ----------

app.use(
  '/api',
  ah(async (req, res, next) => {
    if (configError) {
      console.error(configError);
      return res.status(500).json({ error: 'The server is not set up yet. Check its settings.' });
    }
    await init();
    next();
  })
);

// Photos are public and never change (every upload gets a new random name).
app.get(
  '/api/img/:name',
  ah(async (req, res) => {
    const { rows } = await query('SELECT mime, data FROM images WHERE name = $1', [req.params.name]);
    if (!rows.length) return res.status(404).end();
    res.set({
      'Content-Type': rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(rows[0].data));
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------- helpers ----------

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sameText = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function str(value, max, label) {
  const s = String(value ?? '').trim();
  if (s.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return s;
}

function link(value, label) {
  const s = str(value, 300, label);
  if (!s) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new HttpError(400, `${label} must be a full link that starts with https://`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, `${label} must be a full link that starts with https://`);
  }
  return s;
}

function parseTags(value) {
  const seen = new Set();
  const tags = [];
  for (const raw of String(value ?? '').split(',')) {
    const tag = raw.trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    if (tag.length > 30) throw new HttpError(400, 'Each tag must be 30 characters or fewer.');
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  if (tags.length > 8) throw new HttpError(400, 'Use 8 tags or fewer.');
  return tags.join(', ');
}

// Check the real file type from its first bytes, not the name the browser sends.
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

async function saveImage(file) {
  const ext = sniffImage(file.buffer);
  if (!ext) throw new HttpError(400, 'Use a JPG, PNG, WebP or GIF image.');
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await query('INSERT INTO images (name, mime, data) VALUES ($1, $2, $3)', [name, MIME[ext], file.buffer]);
  return name;
}

async function removeImage(name) {
  if (name) await query('DELETE FROM images WHERE name = $1', [name]);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const imageUrl = (name) => (name ? `/api/img/${name}` : '');

const projectOut = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  link: row.link,
  tags: row.tags ? row.tags.split(', ') : [],
  image: imageUrl(row.image),
  createdAt: new Date(row.created_at).toISOString(),
});

const profileOut = (row) => ({
  name: row.name,
  title: row.title,
  bio: row.bio,
  email: row.email,
  github: row.github,
  linkedin: row.linkedin,
  photo: imageUrl(row.photo),
});

async function getProfileRow() {
  return (await query('SELECT * FROM profile WHERE id = 1')).rows[0];
}

async function getData() {
  const profile = profileOut(await getProfileRow());
  const { rows } = await query('SELECT * FROM projects ORDER BY created_at DESC, id DESC');
  return { profile, projects: rows.map(projectOut) };
}

// ---------- login ----------

const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });

function requireAuth(req, res, next) {
  try {
    jwt.verify(req.cookies.session || '', JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Your session ended. Log in again.' });
  }
}

app.post(
  '/api/admin/login',
  ah(async (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const found = (await query('SELECT count, locked_until FROM login_attempts WHERE ip = $1', [ip])).rows[0];
    let count = found?.count || 0;
    const lockedUntil = Number(found?.locked_until || 0);

    if (lockedUntil > now) {
      const minutes = Math.ceil((lockedUntil - now) / 60000);
      return res.status(429).json({ error: `Too many wrong attempts. Try again in ${minutes} minutes.` });
    }
    if (lockedUntil) count = 0; // the lock ran out

    const { username = '', password = '' } = req.body || {};
    const userOk = sameText(username, ADMIN_USERNAME);
    const passOk = sameText(password, ADMIN_PASSWORD);

    if (userOk && passOk) {
      await query('DELETE FROM login_attempts WHERE ip = $1', [ip]);
      const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: SESSION_MS / 1000 });
      res.cookie('session', token, { ...cookieOptions(req), maxAge: SESSION_MS });
      return res.json({ ok: true });
    }

    count += 1;
    const locked = count >= MAX_ATTEMPTS;
    await query(
      `INSERT INTO login_attempts (ip, count, locked_until) VALUES ($1, $2, $3)
       ON CONFLICT (ip) DO UPDATE SET count = EXCLUDED.count, locked_until = EXCLUDED.locked_until`,
      [ip, count, locked ? now + LOCK_MS : 0]
    );
    if (locked) return res.status(429).json({ error: 'Too many wrong attempts. Login is locked for 15 minutes.' });
    res.status(401).json({ error: 'Wrong username or password.' });
  })
);

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('session', cookieOptions(req));
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAuth, (req, res) => res.json({ ok: true }));

// ---------- public data ----------

app.get(
  '/api/public',
  ah(async (req, res) => res.json(await getData()))
);

// ---------- admin data ----------

app.get(
  '/api/admin/data',
  requireAuth,
  ah(async (req, res) => res.json(await getData()))
);

app.put(
  '/api/admin/profile',
  requireAuth,
  upload.single('photo'),
  ah(async (req, res) => {
    const body = req.body || {};
    const name = str(body.name, 80, 'Name');
    if (!name) throw new HttpError(400, 'Add your name.');
    const title = str(body.title, 80, 'Title');
    const bio = str(body.bio, 800, 'Bio');
    const email = str(body.email, 120, 'Email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Enter an email like you@example.com.');
    }
    const github = link(body.github, 'GitHub link');
    const linkedin = link(body.linkedin, 'LinkedIn link');

    const old = await getProfileRow();
    const photo = req.file ? await saveImage(req.file) : old.photo;
    await query(
      'UPDATE profile SET name = $1, title = $2, bio = $3, email = $4, github = $5, linkedin = $6, photo = $7 WHERE id = 1',
      [name, title, bio, email, github, linkedin, photo]
    );
    if (req.file) await removeImage(old.photo);

    res.json(profileOut(await getProfileRow()));
  })
);

function readProject(body = {}) {
  const title = str(body.title, 120, 'Title');
  if (!title) throw new HttpError(400, 'Add a title for the project.');
  return {
    title,
    description: str(body.description, 600, 'Description'),
    link: link(body.link, 'Link'),
    tags: parseTags(body.tags),
  };
}

const projectId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'That project no longer exists.');
  return id;
};

app.post(
  '/api/admin/projects',
  requireAuth,
  upload.single('image'),
  ah(async (req, res) => {
    const data = readProject(req.body);
    const image = req.file ? await saveImage(req.file) : '';
    const { rows } = await query(
      'INSERT INTO projects (title, description, link, tags, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [data.title, data.description, data.link, data.tags, image]
    );
    res.status(201).json(projectOut(rows[0]));
  })
);

app.put(
  '/api/admin/projects/:id',
  requireAuth,
  upload.single('image'),
  ah(async (req, res) => {
    const id = projectId(req);
    const old = (await query('SELECT * FROM projects WHERE id = $1', [id])).rows[0];
    if (!old) throw new HttpError(404, 'That project no longer exists.');
    const data = readProject(req.body);
    const image = req.file ? await saveImage(req.file) : old.image;
    const { rows } = await query(
      'UPDATE projects SET title = $1, description = $2, link = $3, tags = $4, image = $5 WHERE id = $6 RETURNING *',
      [data.title, data.description, data.link, data.tags, image, id]
    );
    if (req.file) await removeImage(old.image);
    res.json(projectOut(rows[0]));
  })
);

app.delete(
  '/api/admin/projects/:id',
  requireAuth,
  ah(async (req, res) => {
    const id = projectId(req);
    const old = (await query('SELECT image FROM projects WHERE id = $1', [id])).rows[0];
    if (!old) throw new HttpError(404, 'That project no longer exists.');
    await query('DELETE FROM projects WHERE id = $1', [id]);
    await removeImage(old.image);
    res.json({ ok: true });
  })
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- errors ----------

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'That image is larger than 4 MB.' : 'The upload did not work. Try another image.';
    return res.status(400).json({ error: message });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
});

export default app;