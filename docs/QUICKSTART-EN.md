# Academia Krypton — Classroom quickstart (EN)

## Faster local setup (Windows/Linux)

After installing dependencies, creating a local MySQL database/user and editing your `.env` to use **localhost**, run `npm run setup:local` (Windows: `npm.cmd run setup:local`) and then `npm run dev` (Windows: `npm.cmd run dev`). The setup generates Prisma Client, deploys migrations to your **local** database and adds missing fictional demonstration units only. Use `npm run demo:unidades:local` to add just the local units. Both commands reject remote hosts and `NODE_ENV=production`. Do not use an SSH tunnel or forwarded localhost port connected to a remote DB. See the [README](../README.md) for complete instructions.

This repository is an **academic staging environment**, not a production-ready service. For a detailed Portuguese guide, read [GUIA-FACULDADE.md](GUIA-FACULDADE.md).

## Windows (PowerShell)
```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm.cmd ci
Copy-Item .env.example .env
# Edit the local .env and configure DATABASE_URL, JWT_SECRET, SESSION_SECRET
npm.cmd run check:env
npx.cmd prisma generate
npm.cmd run check:db
npm.cmd run prisma:status
npm.cmd run check:syntax
npm.cmd run dev
```

## Linux (Zorin/Ubuntu)
```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm ci
cp .env.example .env
# Edit the local .env and configure DATABASE_URL, JWT_SECRET, SESSION_SECRET
npm run check:env
npx prisma generate
npm run check:db
npm run prisma:status
npm run check:syntax
npm run dev
```

If the repository already exists, check `git status` and preserve local changes before `git pull --ff-only origin main`. Never overwrite a working `.env` automatically.

## Safe environment handling
Use local development credentials at school. Never commit, paste or share your real `.env`, passwords or production database URL. An encrypted personal USB drive is preferable to an unprotected one; use separate local and hosted credentials. Render secrets are configured on Render, not in Git.

`check:env` is local config validation; `check:db` performs read-only SQL/Prisma checks; `prisma:status` only inspects migration status. **Do not run the demo seed on shared/hosted data, or use database reset commands as troubleshooting.**

## What to open
- Application: `http://localhost:3000`
- Lightweight server health: `/api/health` (does not verify database connectivity)
- Units: `/api/unidades` (`[]` means this database has no units)
- API reference: `/api-docs.html` (Swagger UI; offline fallback: `/openapi.json`)

## Roadmap
Professional scheduling, trainer workout plans, nutrition plans, student dashboard, reception check-in/enrollment, admin modules and background jobs are **planned**, not complete. Production deployment requires proper permission checks, data privacy, storage and queue hosting.
