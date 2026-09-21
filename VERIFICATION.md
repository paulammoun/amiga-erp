# Export verification

Prepared 2026-09-20 from saved/published version 109. The source revision was matched exactly to the locally available repository before exporting tracked files. The latest version's deployment was confirmed successful through a read-only Sites status lookup.

## Checks

- Every tracked source file is retained; only the five documented source/configuration files were sanitized or updated. Dependency manifests, pnpm lockfile, migration files and source assets are byte-identical to the saved source.
- All 50 migrations executed in filename order on a fresh SQLite database with foreign keys enabled. Result: 47 application tables; foreign-key check passed. Only ten generic expense categories were seeded. No business records were exported.
- A data-free SQL reference schema was generated from the migrated database.
- The archive is built from an explicit source-file allowlist, excluding Git metadata, node_modules, compiled outputs, caches, logs, database files and local secrets.
- Packaged text is scanned for original Site/deployment/auth identifiers, original domains/account references, embedded PBKDF2 credential values, common token patterns and private-key headers. Logical resource bindings, inert local UUIDs, schema-history UUIDs and synthetic fixtures are retained.
- FILES.sha256 inventories all packaged files except itself. ZIP CRC and extracted-byte checks are performed after packaging.

## Scope limits

No production database was read or exported. No changes, pushes, saved versions, deployments or access changes were made to the source Site. No Site was created in the recipient's account. Cross-account provisioning, entitlement, domain setup and live deployment must be verified by the recipient. The source contains the functionality; production records, branding stored as data, credentials and resource identities are deliberately not transferable in this ZIP.

## Build and runtime validation

- Sanitized source completed all five Vinext production build stages. Expected Worker entrypoint, client assets, sanitized hosting manifest and all 50 packaged migrations were produced.
- TypeScript `tsc --noEmit` passed.
- Fresh administrator-secret tests passed: missing/placeholder rejection, account creation, repeat initialization, correct/incorrect password checks, session creation, and session invalidation after secret rotation.
- Existing database-backup and chart-of-accounts API regression suites passed using synthetic in-memory databases.
- The included local migration helper successfully applied all 50 migrations through Wrangler D1; a second run correctly reported no pending migrations.
- A clean online dependency installation was attempted but downloads repeatedly stalled/failed. Offline cache installation lacked some packages. Build and tests therefore used an isolated copy of the dependencies from the matching source checkout, with links confined to the export workspace. This verifies compilation with the existing dependency set, not a completed fresh registry installation. The original package manifest and lockfile remain unchanged; dependency availability must be checked on the recipient's machine.
- Build warnings: large client chunks and Vinext static route-classification limitations. These did not fail the build. No exhaustive browser/end-user regression or live cross-account deployment was performed.
- Local Worker smoke test passed: root page HTTP 200, login with a newly generated administrator secret, and authenticated superadmin session. Temporary test credentials were removed and are not packaged. Test database state is excluded.
