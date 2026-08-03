# Coursition — Cloudflare deployment and recovery runbook

## Production topology

- Cloudflare Worker: UltraModern SSR, static assets, and Effect BFF.
- D1 binding `COURSITION_DB`: BetterAuth users/accounts/sessions and Coursition course-state JSON.
- R2 binding `COURSITION_SOURCE_BUCKET`: uploaded source bytes.
- Drizzle: schema source and generated migration in `drizzle/`.
- BetterAuth: email/password authentication with the Drizzle D1 adapter.

The verified Worker dry run is about 1.95 MiB gzip, below Cloudflare's 3 MB Free-plan upload limit. The application therefore does not require Workers Paid because of bundle size, and Ax remains included. Recheck the compressed upload size on every release because Cloudflare documents 3 MB for Free and 10 MB for Paid: <https://developers.cloudflare.com/workers/platform/limits/>.

## Prerequisites

- Cloudflare account with Workers, D1, and R2 enabled. The verified bundle fits the Free-plan upload limit.
- Node 26+, mise, and the repository-pinned pnpm 11.13.1.
- A custom HTTPS production origin, for example `https://app.example.cz`.
- Cloudflare authentication available to Wrangler.
- Production AI/provider credentials agreed for the acceptance scenario.

Run all commands from the repository root through `mise exec -- pnpm` when your shell has not activated mise.

## First deployment

1. Install and validate dependencies:

   ```bash
   mise install
   mise exec -- pnpm install --frozen-lockfile
   mise exec -- pnpm ultramodern:check
   ```

2. Create infrastructure:

   ```bash
   mise exec -- pnpm exec wrangler d1 create coursition
   mise exec -- pnpm exec wrangler r2 bucket create coursition-source-assets --location weur
   ```

3. Export the values returned by Cloudflare. Use the real D1 UUID and final origin:

   ```bash
   export CLOUDFLARE_D1_DATABASE_ID='<D1 UUID>'
   export CLOUDFLARE_D1_DATABASE_NAME='coursition'
   export CLOUDFLARE_R2_BUCKET_NAME='coursition-source-assets'
   export MODERN_PUBLIC_SITE_URL='https://app.example.cz'
   export BETTER_AUTH_SECRET='<at least 32 random characters>'
   ```

   Generate the auth secret with `openssl rand -base64 48`. Do not store it in git, screenshots, tickets, or shell history.

4. Build once to generate `.output/wrangler.json`:

   ```bash
   mise exec -- pnpm cloudflare:build
   ```

5. Store secrets in Cloudflare. At minimum:

   ```bash
   mise exec -- pnpm exec wrangler secret put BETTER_AUTH_SECRET --config .output/wrangler.json
   mise exec -- pnpm exec wrangler secret put COURSITION_AI_PROVIDER_API_KEY --config .output/wrangler.json
   ```

   Configure `COURSITION_AI_BASE_URL` and `COURSITION_AI_MODEL` as secrets or Worker variables when using an OpenAI-compatible provider. `OPENAI_API_KEY` and `OPENAI_BASE_URL` are accepted aliases.

   Add only the source providers used by the acceptance scenario:

   - `FIRECRAWL_API_KEY` for web extraction;
   - `LLAMA_CLOUD_API_KEY` for document parsing;
   - `DEEPGRAM_API_KEY` for transcription;
   - `EXA_API_KEY` or `TAVILY_API_KEY` for supported discovery paths.

6. Validate, back up, migrate, backfill, verify, and deploy:

   ```bash
   mise exec -- pnpm cloudflare:deploy
   ```

   This command refuses to run without the D1/R2/site/auth configuration, builds the native Worker, exports a private pre-migration D1 backup into ignored `artifacts/backups`, applies remote migrations, backfills the legacy aggregate into per-draft authority, verifies counts and revisions, and only then deploys. A failed migration or backfill stops before Worker deployment.

7. Bind the custom domain in Cloudflare and run the production golden course from the acceptance audit.

## Local Cloudflare preview

```bash
cp .dev.vars.example .dev.vars
# Replace the placeholder with a random local secret.
MODERN_PUBLIC_SITE_URL=http://localhost:8080 mise exec -- pnpm cloudflare:preview
```

The launcher builds the Worker, applies local D1 migrations, and injects the ignored local secret into Wrangler. Rebuilding `.output` may reset Wrangler's local emulation state; this does not represent remote D1 behavior.

## Release checks

```bash
mise exec -- pnpm ultramodern:check
MODERN_PUBLIC_SITE_URL=https://app.example.cz mise exec -- pnpm build
mise exec -- pnpm cloudflare:build
mise exec -- pnpm exec wrangler deploy --dry-run --config .output/wrangler.json
```

Record the git commit, command output, compressed upload size, Worker version/deployment ID, migration result, origin, and timestamp.

## Backup

Before every migration or acceptance release:

```bash
mkdir -p artifacts/backups
mise exec -- pnpm exec wrangler d1 export coursition --remote --output artifacts/backups/coursition-YYYYMMDD-HHMM.sql
```

Cloudflare documents D1 SQL export/import at <https://developers.cloudflare.com/d1/best-practices/import-export-data/>. D1 Time Travel is automatic; the retention is plan-dependent, so verify the active database with `wrangler d1 info coursition`: <https://developers.cloudflare.com/d1/reference/time-travel/>.

Back up R2 objects separately using an approved S3-compatible backup tool and retain the object manifest with the D1 export. D1 contains R2 references, so a database-only backup is incomplete. R2 encrypts objects and metadata at rest and protects transport with TLS: <https://developers.cloudflare.com/r2/reference/data-security/>.

## Recovery

### Application rollback

Use Cloudflare Workers version rollback in the dashboard or Wrangler, then rerun the smoke test. Do not roll back D1 merely because application code was rolled back.

### D1 point-in-time restore

```bash
mise exec -- pnpm exec wrangler d1 time-travel info coursition
mise exec -- pnpm exec wrangler d1 time-travel restore coursition --bookmark='<bookmark>'
```

Capture the pre-restore bookmark so the restore itself can be undone.

### SQL restore to a replacement database

1. Create a replacement D1 database.
2. Execute the saved SQL export against it.
3. Update `CLOUDFLARE_D1_DATABASE_ID` and rebuild/deploy.
4. Restore the corresponding R2 backup before allowing writes.
5. Run sign-in → resume course → open source → preview acceptance checks.

Never run a destructive restore without a fresh export and an approved maintenance window.

## Operational checks

- `/en` and `/cs` return 200 and the expected localized title.
- `/api/auth/session` returns 200.
- A clean account can sign up, create a course, sign out/in, and resume.
- The API snapshot reports `cloudflare-d1-r2`.
- D1 migration list contains the generated migrations `0000` through `0002`.
- R2 receives source objects and their previews remain available after restart.
- AI generation uses the configured production model; logs contain no secret or source content.
- Cloudflare observability shows no 5xx, recursive loader requests, or Worker memory/startup failures.
