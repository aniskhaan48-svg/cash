# CashBox Cloud Frontend

Next.js frontend for CashBox Cloud.

Production requests use the internal Next.js proxy `/api/backend/*`. Configure only:

```text
BACKEND_URL=https://YOUR-BACKEND-DOMAIN
```

For local development use `BACKEND_URL=http://localhost:3001` in `.env.local`.
