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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Dependency overrides

- `pnpm.overrides["minimatch@>=7.0.0 <11.0.1"]` → `^11.0.1` (GHSA-g3hv-75wg-m249, issue #14).
  `@typescript-eslint/typescript-estree` (via `eslint-config-next`) still declares
  `minimatch@^10.2.2`; this lint-only path is pinned to a patched version. minimatch 3.x/5.x
  used elsewhere are outside the advisory range and left untouched.
  Remove the override once `@typescript-eslint/typescript-estree` depends on `minimatch >=11.0.1`
  (check with `pnpm why minimatch` and `pnpm audit` after deleting it).
