# Railway deployment checklist

- [ ] Push this project to a private GitHub repository.
- [ ] Railway backend service root directory: `/backend`.
- [ ] Backend variable `DATABASE_URL` added as a secret.
- [ ] Backend variable `JWT_SECRET` added as a secret.
- [ ] Backend deployed and `/health` returns `status: ok`.
- [ ] Backend public domain generated.
- [ ] Railway frontend service root directory: `/frontend`.
- [ ] Frontend variable `BACKEND_URL` set to the backend public HTTPS URL.
- [ ] Frontend deployed and public domain generated.
- [ ] Login tested from the Railway frontend domain.
- [ ] Dashboard, transactions, reports, PDF/Excel export, users, settings, and inventory tested.
