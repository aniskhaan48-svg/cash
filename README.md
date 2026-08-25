# CashBox Cloud — Railway Ready

This repository is prepared to deploy to Railway as **one service from the repository root**.

- `frontend/` — Next.js UI (public Railway service)
- `backend/` — Express + Prisma + TiDB Cloud API (runs internally in the same container)
- `scripts/start.js` — starts both applications and connects the frontend proxy to the internal backend
- `railway.json` — root Railway configuration

The browser calls `/api/backend/*` on the Next.js app. The Next.js server proxy then calls the local Express backend. No separate public backend domain is required.

## Railway deployment

1. Push this repository to GitHub.
2. In Railway choose **Deploy from GitHub repo** and select the repository.
3. Leave **Root Directory empty**. Do not set `/backend` or `/frontend`.
4. Add these Variables:

```text
DATABASE_URL=<your TiDB/MySQL Prisma connection string>
JWT_SECRET=<a long random secret, 32+ characters>
NODE_ENV=production
```

5. Do not manually create `PORT`; Railway provides it.
6. Do not set `BACKEND_URL` for the normal single-service deployment; the launcher sets it automatically to the internal backend.
7. Redeploy the latest commit.
8. In **Settings > Networking**, generate a public domain and open `/login`.

Railway reads the root `railway.json` and uses:

```text
Build: npm run build
Start: npm start
Health check: /login
```

## Local development

Backend:

```cmd
cd backend
copy .env.example .env
npm install
npm start
```

Frontend in another CMD window:

```cmd
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Local defaults are frontend `http://localhost:3000` and backend `http://localhost:3001`.

## Security

Never upload the real TiDB password, `DATABASE_URL`, or `JWT_SECRET` to GitHub. Store production secrets only in Railway Variables. If a database password has ever been exposed publicly, rotate it before production use.
