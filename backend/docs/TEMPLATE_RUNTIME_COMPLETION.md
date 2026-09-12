# Template runtime completion — execution record

The approved scope has five deliverables. UI audits alone do not establish server readiness.

| Deliverable | Implemented in this batch | Remaining acceptance work |
| --- | --- | --- |
| Next/fullstack deployment | PR #628 merged; SQLite/PostgreSQL smoke, main CI and Render deployment verified on commit 424f718 | Completed for the supported scaffold path; legacy database migration remains below |
| Remaining clone persistence | No change in this batch | Per-clone server contracts, public catalog versus private customer records, transaction and concurrency rules |
| Manager/staff/customer roles | Server accounts and revocation for all 19 system clones; HR employee and fleet vehicle bindings; field/collection grants and financial projections; owner team panel and role-aware controls | Public clone staff/customer integration and domain-level business invariants |
| Per-template operational tests | Next CRUD smoke; 19 system policy/default-data checks; 34 actual template role-entry cases; HR HTTP isolation/relogin/revocation; real Mongo account restart contract | Full clone matrix including cancellation and concurrent business operations |
| Safe project upgrades | Managed-file hashes, whole-batch conflict detection, pre-write snapshots, rollback on write errors; Render preparation and Next scaffolding use this path | Owner-facing conflict resolution and restore; durable backup retention; tested SQLite-to-PostgreSQL data migration |

## Next deployment behavior

- A `package.json` declaring Next and build/start scripts is detected at the root or `fullstack/`. Two candidate roots are an explicit error.
- New production scaffolds use PostgreSQL. The lower-level template generator retains SQLite as its local default for existing consumers.
- Next uses its own build/start scripts, not the generated Express server. Existing services must match the expected root and commands before receiving secrets.
- With a saved PostgreSQL `DATABASE_URL`, the automatic deployment path creates/reuses the Node service. Without it, the existing Blueprint flow offers creation of a linked PostgreSQL database. It does not claim a database was already provisioned.
- Free Render PostgreSQL is a trial resource with an expiry; production operators must select an appropriate durable plan. No client database is provisioned by these tests.
- Schema synchronization uses `prisma db push --skip-generate` without data-loss/reset flags. Incompatible schema changes stop startup; data migration remains a separate operator task. Seed data is never automatically inserted on deploy.
- Legacy SQLite projects are refused before deployment configuration changes. Their database provider and data are not silently rewritten.

## System account boundary

The project owner creates or resets team accounts from the generated application's team panel. Account passwords are hashed with bcrypt. Login accepts an account name and password; role and record binding always come from the saved server account. Every authenticated request rechecks account revocation, the owner credential version and the database project instance, so a deleted/recreated project cannot inherit a previous team's accounts.

Policies cover 19 system clones. HR employees receive only their employee/attendance/leave/payroll rows; fleet drivers receive only their assigned vehicle and maintenance rows. Clinical financial roles receive a projection without diagnosis/notes. Team administration remains exclusive to the project administrator. Grant checks protect keys, records and editable fields; they do not by themselves establish every accounting, stock or workflow invariant.

New system data stores are initialized once from static template defaults parsed without executing project code. Existing transaction documents or legacy data are never overwritten by this initialization. Unsupported customized initialization remains owner-managed. The filesystem source reader refuses symlinks and oversized input. Team role controls are a usability aid; server authorization applies even to manually forged requests.

## Upgrade boundary

The generated-file manifest stores hashes, not credentials. New files can be added. An existing untracked file can be adopted only when it already matches the generated version. Subsequent updates are allowed only if its previous managed hash still matches. A custom-file conflict stops the entire batch before writing.

Snapshots are stored outside the exported project under the sibling `.jaola-upgrade-backups` directory with private permissions. They include the previous generated files and manifest. They are filesystem snapshots, not database backups; their durability depends on workspace storage. No automated database migration or owner-facing restore UI is claimed by this batch.

## References

- [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Next.js security releases](https://nextjs.org/blog/tag/security) — generated Next version 15.5.24, verified 2026-09-12.
