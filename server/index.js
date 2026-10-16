// Local server only (npm run dev / npm start). On Vercel, api/[...path].js is used instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

// Imported after .env is loaded, because app.js reads the settings when it loads.
const { default: app, configError } = await import('./app.js');
if (configError) {
  console.error(`${configError}\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

// "npm start" after "npm run build": serve the built site too.
const dist = path.join(root, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
