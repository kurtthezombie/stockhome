This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Checks and tests

```bash
npm run lint        # ESLint: Next.js, React, and TypeScript rules
npm run lint:fix    # Apply safe ESLint fixes
npm run typecheck   # TypeScript checking
npm test           # Run Vitest once
npm run test:watch  # Rerun tests while editing
```

Vitest runs unit and React component tests in `tests/*.test.ts` and `tests/*.test.tsx`. React Testing Library provides user-facing queries and interactions; jest-dom adds DOM assertions. The setup supports the `@/` import alias and cleans up rendered components after each test. Utility tests can opt into the Node environment.

These tests do not connect to Supabase. Database migration and account-isolation tests remain in `tests/grocery-db.test.sql`; see [database setup and verification](supabase/README.md). Authenticated browser workflows still need end-to-end testing.

## Learn More

For optional local code relationship exploration, see the [Graphify pilot](GRAPHIFY.md).

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
