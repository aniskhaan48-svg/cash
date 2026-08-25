# CashBox Cloud — GitHub + Railway Ready

This repository is prepared as a monorepo with two independently deployable Railway services:

- `backend/` — Express + Prisma + TiDB Cloud API
- `frontend/` — Next.js UI

The frontend no longer exposes a public backend URL in browser code. It sends requests to a Next.js server-side proxy at `/api/backend/*`, and that proxy reads the private `BACKEND_URL` environment variable at runtime.

## 1. Upload to GitHub

Create a new empty GitHub repository, then from this project root run:

```bash
git init
git add .
git commit -m "Prepare CashBox Cloud for Railway"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Do not commit `.env` files. Only `.env.example` belongs in GitHub.

## 2. Deploy the backend on Railway

Create a Railway project and choose **Deploy from GitHub repo**. Create the first service using this repository and set its **Root Directory** to:

```text
/backend
```

Railway will read `backend/railway.json`.

Add these backend variables in Railway:

```text
DATABASE_URL=<your TiDB Cloud mysql:// connection string>
JWT_SECRET=<a long random secret>
FRONTEND_URLS=http://localhost:3000
```

Railway injects `PORT` automatically; do not create a production `PORT` variable manually.

Generate a public domain for the backend. Test:

```text
https://YOUR-BACKEND-DOMAIN/health
```

Expected response:

```json
{"name":"CashBox Cloud","status":"ok"}
```

## 3. Deploy the frontend on Railway

In the same Railway project, create a second service from the same GitHub repository and set its **Root Directory** to:

```text
/frontend
```

Add this frontend variable:

```text
BACKEND_URL=https://YOUR-BACKEND-DOMAIN
```

Railway will read `frontend/railway.json`. Generate a public domain for the frontend after deployment.

## 4. Optional backend CORS setting

The browser normally talks only to the Next.js proxy, so CORS is not required between the browser and backend. If you later call the backend directly from browser code, set:

```text
FRONTEND_URLS=https://YOUR-FRONTEND-DOMAIN
```

Multiple origins can be comma-separated.

## 5. Local development

Backend:

```bash
cd backend
copy .env.example .env
npm install
npm start
```

Frontend in another terminal:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Local defaults are frontend `http://localhost:3000` and backend `http://localhost:3001`.

## Security

Never upload the real TiDB password, `DATABASE_URL`, or `JWT_SECRET` to GitHub. Store them only as Railway environment variables. If a database password has ever been shared in chat, screenshots, Git history, or a public repository, rotate it before production use.
