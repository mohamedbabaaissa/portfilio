# Portfolio with admin dashboard

React + Vite on the front, Node + Express on the back, Postgres for the data.
Runs on Vercel (free plan is enough).

## Put it online (Vercel + Neon)

1. Push this project to GitHub.
2. On vercel.com: **Add New > Project**, pick the repo. Leave the build settings as they are
   (`vercel.json` already sets them).
3. Before you press Deploy, open **Environment Variables** and add:
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD`: your login
   - `JWT_SECRET`: random, 32+ characters
     (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `VITE_ADMIN_PATH`: your secret admin address, for example `my-private-door`
4. Deploy. The first deploy shows an error page for the data until step 5 is done.
5. In your Vercel project open **Storage > Create Database > Neon (Postgres)** and connect it to the project.
   Vercel adds `DATABASE_URL` for you. Then go to **Deployments > the three dots > Redeploy**.
6. Open `https://your-project.vercel.app/your-secret-path`, log in, and set your name, title, bio, photo and projects.
   They are saved in the database, so they stay after every redeploy.

If you change `VITE_ADMIN_PATH` later, redeploy (it is baked into the site when it is built).

## Run it on your computer

You need Node.js 20 or newer and a Postgres connection string (use your Neon one, or a free Neon branch for testing).

1. `npm run install:all`
2. Copy `.env.example` to `.env` and fill it in (including `DATABASE_URL`).
3. `npm run dev`
4. Public site: http://localhost:5173, admin: http://localhost:5173/your-secret-path

## How the admin is protected

- Login is checked on the server. After 5 wrong attempts the address is locked for 15 minutes.
- The session lasts 12 hours and lives in an HttpOnly, same-site cookie.
- All admin API routes need that cookie. The secret path only hides the login page; the password is the real protection.
- Uploads are checked by their real file type (JPG, PNG, WebP, GIF), capped at 4 MB, and saved under random names.

## Where to change things

- Skills in the scrolling strip and the intro text next to "Latest projects": `client/src/config.js`
- Colors and fonts: `client/src/styles/public.css` (public site) and `admin.css` (admin)
- Everything else (name, title, bio, photo, email, links, projects): the admin
