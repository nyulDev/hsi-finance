# hsi-finance-backup

## Required environment variables

### `DATABASE_URL`

Prisma expects `DATABASE_URL` during commands like:

- `npx prisma migrate deploy`
- `prisma generate`

Create one of the following files in the project root:

- `.env` **or** `.env.local`

Example (copy from `.env.example`):

```bash
cp .env.example .env.local
# edit DATABASE_URL inside .env.local
```

Then run migrations:

```bash
npx prisma migrate deploy
```

---

## Getting started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses Next.js.
