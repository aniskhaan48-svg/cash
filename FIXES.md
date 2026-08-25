# Railway fixes in this package

1. Added a root `start` command so Railpack can detect how to run the application.
2. Added root `railway.json` with explicit build/start commands and `/login` health check.
3. Added root `package-lock.json` support for deterministic root installation.
4. Added a Node launcher (`scripts/start.js`) that runs both services in one Railway container:
   - Next.js frontend on Railway's public `PORT`.
   - Express/Prisma backend on an internal local port.
5. The frontend proxy receives `BACKEND_URL` automatically at runtime; no public backend domain is required.
6. Railway can now deploy from repository root; no `/backend` or `/frontend` Root Directory is required.
7. Real secrets remain outside Git. Configure `DATABASE_URL` and `JWT_SECRET` only in Railway Variables.
