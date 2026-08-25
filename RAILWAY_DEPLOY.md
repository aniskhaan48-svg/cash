# CashBox Cloud - Railway deployment

This package is prepared for deployment from the repository root as ONE Railway service.
Do not set a Root Directory in Railway.

## 1) GitHub source
Repository: https://github.com/aniskhaan48-svg/cash
Branch: main

## 2) Railway service
Create/deploy the service from the GitHub repository.
Keep Root Directory empty (repository root).
Railway reads the root `railway.json` automatically.

Build command:

    npm run build

Start command:

    npm start

The public Railway PORT is used by Next.js. The Express backend runs internally on port 3001 (or 3002 only if Railway assigns 3001 to the public service). The Next.js `/api/backend/*` proxy talks to the internal backend.

## 3) Required Railway Variables
Add these in Service > Variables:

    DATABASE_URL=<your TiDB/MySQL Prisma connection string>
    JWT_SECRET=<a long random secret, 32+ characters>
    NODE_ENV=production

Do NOT manually set PORT. Railway supplies it.
BACKEND_URL is optional in the single-service deployment and should normally be left unset.
FRONTEND_URLS is also optional because browser requests go to Next.js, then use the server-side proxy.

## 4) Public URL
After deployment succeeds, open Settings > Networking and Generate Domain.
Open `/login` on that domain.

## 5) Health checks
Railway health check: `/login`
Backend internal health endpoint: `/health`

## 6) If deployment was previously configured with /backend
Remove the Root Directory setting so Railway deploys from the repository root. Then redeploy the latest commit.
