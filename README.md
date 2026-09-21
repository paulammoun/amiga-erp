# AMIGA-ERP — independent source distribution

Sanitized editable source from published version 109, exported 2026-09-20. The original Site was not changed. This is a source template, not a business database backup or one-click account transfer.

## Contents

Complete application source is in app/, components/, db/, lib/, hooks/; source assets in public/ and vendor/; Sites build integration in build/; dependency manifests and pnpm-lock.yaml at the root. All 50 ordered migrations, snapshots and journal are in drizzle/. db/schema.ts is the editable Drizzle schema; db/schema.sql is a data-free reference schema generated from those migrations. Do not apply schema.sql in addition to the migrations. scripts/ includes build helpers and existing regression tests using synthetic fixtures. docs/ contains feature notes.

.openai/hosting.json retains only logical resource declarations: D1 binding DB, no R2. It contains no original Site identifier. .env.example and .dev.vars.example contain placeholders only.

## Tools and services

Use Node.js >=22.13.0 and pnpm 11.25.0 (declared in packageManager), with public npm registry access. Preserve pnpm-lock.yaml. The app uses React, Vinext/Vite, Cloudflare Workers, D1/SQLite and Drizzle. The recipient needs their own account with Sites creation/deployment available and the Sites integration; availability and quotas depend on that account.

One fresh D1 database bound as DB is required. No OpenAI API key, external business API, R2 bucket, or email service is needed. Sites provisions managed hosting; standalone Cloudflare deployment would instead require the developer's own account and separately prepared deployment configuration.

## Local setup

1. Extract into a new directory outside any existing Site/project.
2. Install the declared pnpm version, then run `pnpm install --frozen-lockfile --prod=false`. The historical install:ci command invokes Bash; direct pnpm installation is the portable Windows alternative using the same lockfile.
3. Run `node scripts/generate-admin-secret.mjs` privately. Save the generated password in your password manager. Copy .dev.vars.example to .dev.vars and replace its placeholder with the generated single-quoted hash assignment. Never share the generated output or commit .dev.vars. .env.example documents the variable; .dev.vars is the local Worker secret file.
4. Run `pnpm build`.
5. Run `node scripts/migrate-local.mjs`. This applies pending migrations through Wrangler's migration ledger to local .wrangler/state only. It cannot apply to a hosted database.
6. Run `pnpm dev` and use the printed loopback URL, normally port 5173. The development preview uses local database state. For a built Worker preview, separately supply the secret to Wrangler relative to its generated config before using `pnpm start`; never include that local secret file in a deployment artifact.
7. Sign in as `superadmin` using your generated password. Create your own company and first administrator in company management. Use the company-qualified username shown by the application. Configure branding, currency, tax, chart of accounts, posting accounts and inventory policies before entering transactions.

Do not generate replacement migrations on initial setup. Historical backfills safely operate on an empty database. Ten generic expense categories are seeded; no customers, suppliers, invoices, items or users are bundled. Review application defaults for your own business.

## Environment and bindings

| Name | Type | Required | How to configure |
| --- | --- | --- | --- |
| DB | D1 binding | Yes | Fresh database provisioned by Sites from the logical d1 declaration; local preview simulates it. Not an environment-variable string. |
| SUPERADMIN_PASSWORD_HASH | Server-side secret | Yes | New PBKDF2-SHA256 hash from the included generator; .dev.vars locally, runtime secret on the NEW Site in production. Never use NEXT_PUBLIC_ or VITE_ prefixes. |

The source Site had no custom runtime environment variables configured. SUPERADMIN_PASSWORD_HASH replaces an embedded credential removed from this export. Missing/placeholder values deliberately prevent login. Keep the secret configured after setup: the existing authentication flow synchronizes the fixed superadmin account to it. Rotating the hash changes that password and invalidates that account's sessions during the next synchronization. Company users are managed within the application.

Optional tooling variables: CLOUDFLARE_CF_FETCH_ENABLED and WRANGLER_SEND_METRICS default to false; SITES_PNPM_SHARED_STORE optionally selects a dependency cache. Standard Node/package-manager and local tooling variables also appear in the build helpers; no original account values are required.

## Recreate in another ChatGPT Sites account

Provide this ZIP to a new task in the recipient's own account with Sites available. Suggested request:

> Use this sanitized source template to create a NEW independent Site. Preserve its architecture and lockfile. Register a new Site, provision a fresh D1 binding named DB and apply all included migrations. Do not reconnect any original Site or repository. Configure my newly generated SUPERADMIN_PASSWORD_HASH as a secret on the new Site. Build and publish after checking the fresh database.

The recipient's Sites agent should:

1. Extract into a new checkout and use the retained-template workflow, not a replacement starter. Verify hosting.json has no project_id before registration.
2. Register a new Site once, then write only the newly returned project identifier into hosting.json. Obtain a new source repository connection. There is no Git metadata or remote in this export.
3. Configure the new administrator hash as a runtime secret on that new Site, through the recipient's private setup flow. Do not put it in the manifest or build output.
4. Install locked dependencies and build. Preserve dist/server/index.js, generated static assets, dist/.openai/hosting.json and dist/.openai/drizzle/ in the deployment artifact. The logical DB declaration lets Sites provision fresh storage and apply the packaged migrations.
5. Save/publish using the new Site and new repository. Set the recipient's intended access policy; verify login, company creation and sample workflows with disposable test data.
6. Use the newly assigned domain. An optional custom domain requires independent ownership verification and DNS setup. Do not reuse the source Site's domain or resource configuration.

This ZIP is editable source, not a ready-to-deploy Sites artifact: extract, configure, register and build it first. Cross-account deployment was not attempted during export; actual resource creation and access must be verified in the recipient's account.

## What does not transfer

- Original Site, deployment, database, auth-client and repository identities; domains/DNS/TLS, version history, access lists, collaborators, account entitlements and hosting configuration tied to the owner.
- Passwords, original password hashes, tokens, API keys, sessions and runtime credentials. Create new credentials.
- All business records and database-stored customization: companies/users, contacts, items, prices, inventory, accounts, transactions, reports, settings and uploaded logos. Re-enter desired configuration and branding in the new installation.
- Database contents/backups, local state, Git history, installed dependencies, generated build output, caches and logs.

All four source SVG assets are included. Database-stored logos are deliberately excluded with business data. Synthetic test fixtures and generic reference defaults remain as source logic. The all-zero-style placeholder UUID in vite.config.ts is an inert local emulator identifier, not a production database ID. Drizzle snapshot UUIDs describe schema history, not hosted resources.

## Export-only changes and verification

Removed the original project_id; replaced the embedded administrator hash with a required server secret; added its type declaration and ignored local-secret files; added example files, a secret generator, a local migration helper, this README and the reference SQL schema. Other application source, migrations, assets, dependency declarations and lockfile are preserved.

See VERIFICATION.md for checks and limitations. FILES.sha256 records integrity hashes for packaged files.

