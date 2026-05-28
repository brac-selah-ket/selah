# Turso + Cloudflare R2 Cutover Checklist

## Completed

- Turso database created: `storyboard`
- Cloudflare R2 bucket created: `storyboard-assets`
- Turso schema pushed with Drizzle
- Neon snapshot imported into Turso and verified
- App reads and writes route through the storyboard repository
- File storage routes through `lib/storage`

## Vercel Environment Variables

Set these when cutting production over:

```bash
DATABASE_PROVIDER=turso
TURSO_DATABASE_URL=libsql://storyboard-jaepang.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=<secret>
STORAGE_PROVIDER=cloudflare-r2
CLOUDFLARE_ACCOUNT_ID=5013d3603d9bcb15de0ce6953fa8b42b
R2_ACCESS_KEY_ID=<secret>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=storyboard-assets
R2_PUBLIC_BASE_URL=<public bucket or custom domain URL>
```

Keep `BLOB_READ_WRITE_TOKEN` until legacy Vercel Blob objects are migrated or intentionally left behind.

## R2 Requirements

- Create an R2 API token with read/write access to `storyboard-assets`.
- Enable a public read URL for the bucket, either an `r2.dev` public URL or a custom domain.
- Use that exact public URL as `R2_PUBLIC_BASE_URL`.

## Verification

```bash
pnpm exec tsc --noEmit --pretty false
pnpm lint
node --experimental-strip-types --test lib/actions/provider-boundary.test.ts lib/storage/storage.test.ts lib/db/time.test.ts lib/db/turso.test.ts lib/repositories/storyboard/verify.test.ts
pnpm db:verify:turso
```

`pnpm db:verify:turso` compares the local Neon snapshot file with Turso. Re-export Neon first if production Neon changed after the last import.
