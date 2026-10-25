# masqq

Browser-based voice/video calls where the host is anonymous and every guest is identified. See `CLAUDE.md` for the full brief.

## Local setup

1. `cp .env.example .env` and fill in the Phase 1 values: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS` and `APP_URL`. Later-phase keys can stay empty for now.
2. `npm install` (this also runs `prisma generate`)
3. `npm run db:migrate` applies migrations to Neon.
4. `npm run dev`, then open http://localhost:3000

### Google OAuth client

In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** of type **Web application** with:

- Authorised JavaScript origins: `http://localhost:3000` (plus your production URL)
- Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google` (plus `https://<prod-domain>/api/auth/callback/google`)

Put the client ID and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
