# Template quality audit and completion plan

Date: 2026-09-12. Static inspection of the local repository following PR #618. This is a source-level inventory, not certification of deployed applications.

## Findings

- The executable clone registry contains 41 builders. Other template families include templateLibrary.js, templateLibraryExtended.js, fullstackTemplates.js and the external registry. Counts below cover clones only.
- 38 clone outputs reference localStorage; 19 reference JAOLA_SYNC; 23 contain fetch calls. These are textual indicators, not proof of working persistence or authentication. Absence of JAOLA_SYNC does not establish absence of injected synchronization.
- services/dataSync.js injects synchronization. PUT requests do not check HTTP success; network failures are swallowed. There is no acknowledged-save state or durable retry queue in this script. Initial loading falls back after a timeout. Concurrent writes and reconnection need explicit acceptance tests.
- agents/fullstackTemplates.js renderListRoute/renderItemRoute generate CRUD endpoints that pass request JSON directly to Prisma. These generated handlers contain no authentication, authorization or field allowlist. Inspect final generated middleware and deployment before assessing exposure; the scaffold itself does not supply these protections.
- stages/buildFromClone.js already performs behavioral verification and one completion attempt with rollback checks. tests/cloneCompletion.test.mjs explicitly distinguishes textual evidence from executable behavior. Preserve and strengthen this work.
- A role listed in metadata or a hidden button does not prove server-side access enforcement.

## Completion order

1. Define per-template capability contracts: website/system, supported workflows, data mode, roles, integrations, unsupported features and evidence required for readiness. Keep readiness separate from keyword match score.
2. Harden shared persistence: acknowledged saves, visible errors, retries with idempotency, version conflicts and two-device tests. Determine existing server guarantees before choosing a migration.
3. Harden generated APIs: authenticated sessions, server-side role checks, project/tenant ownership, input schemas and explicit field allowlists. Test direct requests, not just UI controls.
4. Pilot full workflow verification on POS, warehouse and helpdesk; these exercise transactions, inventory and role transitions. Add a public store/booking pilot to verify the website route separately.
5. Extend each remaining clone against its own contract, reusing proven services. Do not mark all systems complete merely because common scaffolding passes.
6. Add new clones only for a demonstrated capability gap after the shared base and pilots pass. Record origin and reuse terms for imported code and assets.

## Acceptance evidence

- Websites: real navigation, working forms, validation and error states, mobile and Arabic RTL, accessible controls, images and links, applicable SEO, successful generated build.
- Systems: all website interaction checks plus durable data, reload/restart recovery, two-account isolation, server-enforced roles, concurrent edits, deletion, export/restore and domain invariants.
- POS/accounting: totals, rounding, refunds and balanced entries; inventory: stock conservation and concurrent sale/receipt; booking: prevention of conflicting reservations.
- Verify both pristine template output and the customized generated application. Bind readiness evidence to a template version; invalidate affected evidence after changes.
- Keep AI evaluation offline with mocked provider transports unless separately authorized.

## Clone inventory

Static output indicators only. Every row still requires workflow-level and deployed verification. Roles below are declarations, not verified permissions.

| Clone | Track | Files | localStorage | JAOLA_SYNC | fetch | Declared roles |
|---|---|---:|---|---|---|---|
| jaola-delivery | website (default) | 3 | True | False | False | Customer, Restaurant, Driver, Admin |
| jaola-store | website (default) | 3 | True | False | False | Customer, Admin |
| jaola-booking | website (default) | 3 | True | False | False | Customer, Admin |
| jaola-realestate | website (default) | 3 | True | False | False | User, Admin |
| jaola-marketplace | website (default) | 3 | True | False | False | Customer, Seller, Admin |
| jaola-taxi | website (default) | 3 | True | False | False | Rider, Driver, Admin |
| jaola-travel | website (default) | 3 | True | False | True | Traveler, Admin |
| jaola-events | website (default) | 3 | True | False | False | Buyer, Organizer, Admin |
| jaola-lms | website (default) | 3 | True | False | False | Student, Instructor, Admin |
| jaola-school | website (default) | 3 | True | False | False | Student, Teacher, Admin |
| jaola-weather | website (default) | 3 | False | False | True | User |
| jaola-crypto | website (default) | 3 | False | False | True | User |
| jaola-currency | website (default) | 3 | False | False | True | User |
| jaola-erp | system | 3 | True | True | True | مالك, محاسب, أمين المخزن |
| jaola-clinic | system | 3 | True | True | True | طبيب, استقبال, محاسب |
| jaola-hr | system | 3 | True | True | True | مدير, موظف |
| jaola-pos | system | 3 | True | True | True | مدير, كاشير |
| jaola-restaurant-ops | system | 3 | True | True | True | مدير, نادل, مطبخ |
| jaola-pharmacy | system | 3 | True | True | True | مدير, صيدلي |
| jaola-property | system | 3 | True | True | True | مالك, محاسب |
| jaola-cinema | site | 3 | True | False | False | مشاهد, إدارة |
| jaola-workshop | system | 3 | True | True | True | مدير, فنّي, استقبال |
| jaola-gym | site | 3 | True | False | False | عضو, إدارة |
| jaola-accounting | system | 3 | True | True | True | مدير مالي, محاسب |
| jaola-salon | site | 3 | True | False | False | عميل, إدارة |
| jaola-warehouse | system | 3 | True | True | True | مدير مستودع, مشغّل |
| jaola-hotel | site | 3 | True | False | False | نزيل, إدارة |
| jaola-laundry | system | 3 | True | True | True | موظف استقبال, مشغّل مغسلة |
| jaola-carrental | site | 3 | True | False | False | مستأجر, إدارة |
| jaola-lawfirm | system | 3 | True | True | True | محامٍ, سكرتير قانوني |
| jaola-coworking | site | 3 | True | False | False | عضو, إدارة |
| jaola-helpdesk | system | 3 | True | True | True | وكيل دعم, مشرف |
| jaola-photography | site | 3 | True | False | False | عميل, إدارة |
| jaola-fleet | system | 3 | True | True | True | مدير أسطول, سائق |
| jaola-tutoring | site | 3 | True | False | False | طالب, إدارة |
| jaola-vetclinic | system | 3 | True | True | True | طبيب بيطري, استقبال |
| jaola-cleaning | site | 3 | True | False | False | عميل, إدارة |
| jaola-vetclinic-react | system | 3 | True | True | True | طبيب بيطري, استقبال |
| jaola-crypto-advisor | system | 3 | True | True | True | مالك الحساب |
| jaola-budget-advisor | system | 3 | True | True | True | صاحب الحساب |
| jaola-stock-advisor | system | 3 | True | True | True | مالك الحساب |

## First implementation batch

The shared synchronization script now reports rejected HTTP writes and network failures with a visible alert and a `jaola:sync-error` event. Storage interception uses `Storage.prototype` while excluding sessionStorage and `_session` keys. A delayed initial response cannot overwrite a key edited during the current page session. A focused browser-DOM regression test exercises HTTP 403, actual Storage interception, excluded session storage and late hydration.

Remaining: durable retries, write timeouts, ordering/conflict control between writes/devices, deletion propagation, project-scoped local cache, and generated API authorization. The warning intentionally stays visible after failure: a later successful write does not prove earlier writes were saved. This change does not retrofit already generated deployed scripts; those require a controlled regeneration/update. No template is newly certified production-ready by this batch.

### Same-page write ordering

Writes for each storage key now wait for the preceding request to settle; unrelated keys remain independent. Tests hold the first request open, verify the second is not dispatched early, and verify that a rejected request reports failure without permanently stalling later writes. Completed queues are removed. This reduces reordering during normal acknowledged requests within one page. A network error can leave server completion unknown: this is not a cross-device conflict solution or a transaction guarantee. Requests that never settle and reload durability still need further work.

### Public data error semantics

The public data GET/PUT handlers previously returned empty success/204 for invalid project tokens. They now return HTTP 401, allowing the sync script to detect rejection. Unexpected exceptions escaping the GET storage call return HTTP 500. Handler tests execute the actual route registrations with stubbed storage and verify rejected identities never access storage and valid writes retain their success contract.

Important remaining authorization gap: these handlers verify a published project token, not an authenticated end-user session or role. The token selects owner/project storage but is embedded in client code. Project login alone does not protect these endpoints. Remediation requires coordinated session issuance, protected endpoint checks, and migration of generated clients; changing only UI login is insufficient. Also, readStore currently swallows disk/JSON errors internally, so HTTP 500 does not yet cover those failures.

### Storage corruption and generated-client migration

Credential files that exist but cannot be parsed or contain an invalid bcrypt hash now fail closed: login rejects and password replacement cannot silently reset them. Missing credential files still use the legacy default; removing that behavior requires owner-only initial provisioning and coordinated client migration.

Data reads now distinguish missing files from corruption/read errors. A write cannot replace a corrupt store with a new empty-derived value. Writes stage JSON in a unique sibling file and rename it over the destination, reducing exposure to truncated JSON; this is not a multi-process transaction or fsync durability guarantee.

installDataSync now refreshes recognized generated scripts on repeat installation when content/configuration differs, retaining the previous Babel script type. Custom scripts are left untouched. Already hosted copies still require republishing; no production deployment was performed.

Validation: full backend run passed 2131 tests after storage hardening. The subsequent installer migration passed all 33 focused data/auth/architecture tests. Session-based authorization, owner-only initial setup and per-role controls remain OPEN; do not claim the security workstream complete or certify templates on these results alone.

## Shared project administrator boundary — implementation checkpoint

The shared public data/collections/assets/budget/crypto/stock API families now require both the published project identity token and a separate one-hour administrator session. Sessions bind owner, project, credential version and a fixed project-admin role with a separate signing domain. Password rotation invalidates earlier sessions; signing-key rotation intentionally requires re-login. Browser logout discards the in-memory credential; copied bearer tokens remain valid until expiry or password rotation.

Initial credential setup/reset is only available through the authenticated platform owner route `/api/project/access-password`, with existing ownership middleware. The dashboard exposes it under project settings and the secrets dialog. Public first-time setup and default-password login no longer authorize access. Public password changes require existing credentials and at least 12 characters. New generated clients present a shared login gate, attach sessions only to their configured API origin, and keep synchronized values in page memory, avoiding reuse of an old browser account cache. Hydration failure blocks app startup instead of promoting demo seed data into writes.

Rollout: deploy backend and dashboard together; owner sets a project password; regenerate/re-publish recognized JAOLA sync clients. Old clients intentionally receive 401 rather than retaining insecure compatibility. Existing custom clients require integration with the login/session contract. No automatic production rollout has been performed.

Scope: a shared project-administrator credential, NOT distinct employee accounts or per-role authorization. Template role dropdowns remain workflow presentation and must not be advertised as security roles. Standalone generated Full Stack API authorization, per-user RBAC, conflict-safe database transactions and reliable offline outboxes remain separate template-readiness work. This checkpoint closes anonymous access to the shared data families, not every possible security issue in every generated app.

## Warehouse completion checkpoint

Outbound shipment posting now aggregates repeated item lines and validates every quantity, available balance and combined total before any inventory mutation. This closes a reproducible negative-stock case when a prepared shipment's stock has dropped before posting. Invalid, missing, fractional, non-finite and negative quantities are rejected; exact-stock duplicate lines remain valid. Tests execute the actual generated app.js and check that rejected shipments do not change inventory, sequence, shipment history or persisted values.

This is a same-page business-rule fix. Cross-device transaction enforcement remains necessary on the server. Inbound posting also validates all lines before mutation, rejects missing items and invalid quantities, and checks cumulative integer overflow. Multi-key writes are not atomic transactions. The warehouse template remains under completion, not production-certified.

## POS checkout checkpoint

Checkout validates positive integer quantities, finite nonnegative prices, payment method and safe integer cent totals before changing sale history or receipt sequence. Totals and cart display use rounded two-decimal unit prices, matching the existing money display policy. Sale line objects are copied. The cart is cleared before printing; a printer exception reports that the sale was recorded and cannot leave the paid cart ready for another checkout. Regression tests reproduced invalid sales, floating-point total differences and retained carts after printer errors before the fix.

This does not confirm remote payment settlement or server persistence. Multi-device receipt numbering, durable atomic sale persistence, currency-specific precision and refunds remain POS completion work.

## POS and helpdesk workflow batch

This batch includes checkout validation and printer-failure handling, strict product price entry, receipt-sequence validation, integer-cent shift totals, and receipt-number boundaries for new shift closures. New receipts at the same millisecond as closure are assigned to the following shift once. Existing shift records without a receipt boundary keep their timestamp-based compatibility behavior; ambiguous old timestamps are not retroactively reconstructed.

Helpdesk preserves its open/in-progress/resolved/closed lifecycle, rejects unknown state transitions instead of resetting them to open, and makes closed tickets read-only for replies (no reopen workflow in this batch). Reply controls reflect availability. Regression tests execute generated application code and cover both rejected operations with no writes and valid workflow completion.

Batch scope is these POS/helpdesk workflows. It is not certification that all 41 clones are complete. Shared administrator access remains as implemented in PR #619; individual staff authorization, multi-device transactions, real payment settlement, refunds and domain-specific production acceptance are still outstanding.

## Combined transaction and template batch (PR #621 update)

This checkpoint supersedes earlier descriptions of the single-key PUT synchronization path.

- All 38 clones that write browser storage now propagate storage-write errors instead of swallowing them. The three read-only external-data tools do not need a storage-write helper. This stops subsequent success steps on synchronous storage failure; it does not roll back an already mutated in-memory view.
- All 19 system clones receive the authenticated, versioned transaction bootstrap when published, including the React/Babel template. Unsupported or failed bootstrap installation now blocks deployment. The 22 website clones remain website flows; this batch does not turn their browser demos into server-backed shops or booking engines.
- Related storage writes in one synchronous action are sent in one project transaction. Mongo atomically updates project data, revision and an idempotency receipt in one document, using an expected revision filter. Conflicts return 409; retries preserve request identity and payload. No filesystem or memory fallback reports success while Mongo is unavailable. This follows Mongo's [single-document atomicity contract](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).
- Acknowledged writes are serialized. The client exposes `JAOLA_SYNC.flush()`, warns before leaving with pending writes, and freezes editing on a conflict or uncertain final result. It does not claim offline durability or automatically merge conflicting changes. The receipt history retains the last 128 commits; stale revisions still reject requests outside that history.
- POS prints and reports a completed sale only after acknowledgement in a published system. Budget mutations also wait for acknowledgement and reject overlapping submission. Budget refresh waits for pending saves before reloading the current server snapshot.
- Legacy app-data files are imported once on first access. The budget advisor also imports its existing transactions/budgets collections. Files remain untouched as a migration source; old clients receive 428 on single-key/collection mutations and require republishing. Corrupt legacy collections fail explicitly instead of being treated as empty.
- Limits are explicit: 60 storage keys, 512 KiB per value, 4 MiB project data. Existing data exceeding these bounds requires an explicit migration, not truncation. Large-collection pagination remains a separate design requirement.
- GitHub CI now supplies a local Mongo 7 service and runs the same concurrency contract against a real database. Local runs without that service mark this test skipped rather than claiming database verification.

### Rollout and remaining acceptance boundaries

Before deploying these changes, back up Mongo and the legacy app-data/collections directories, ensure Mongo is available, configure each system's owner-managed access password, and republish generated systems. Verify a save/reload and conflicting edits in two sessions on the deployed app. A rollback to the old file-writing server would lose visibility of newer Mongo writes; rollback therefore requires an explicit data reconciliation, not merely reverting JavaScript.

This is a shared persistence and template error-handling completion batch, not certification that every business domain is production-complete. Employee-specific roles, stock/refund/accounting rules enforced on the server, public-store payments and reservation locks, standalone full-stack CRUD authorization, and auxiliary file/alert operations are not supplied by the project snapshot transaction. Uploaded assets and external provider effects are not atomic with this document. Those acceptance gaps remain open and must not be inferred complete from the 41-template behavioral harness.

Local validation for this combined batch: 2,224 backend tests discovered, 2,223 passed, zero failed, one explicitly skipped (real Mongo, to run in CI). This includes the behavioral harness for all 41 clones, bootstrap coverage for all 19 systems, storage-failure tests for the generated save helpers, and acknowledgement/conflict/replay tests. Provider SDK transports were mocked. `git diff --check` passed. These counts are automated code evidence; no live deployment or payment-provider verification was performed.

## Standalone full-stack API authorization follow-up

The eight full-stack categories now emit a shared server-only API guard. Mutations require a per-deployment `JAOLA_ADMIN_TOKEN`; private reads accept that key or a separate `JAOLA_READER_TOKEN`. Keys shorter than 32 characters, absent configuration and anonymous requests fail closed. These are service credentials, not employee accounts; never distribute them in public browser code. Existing deployments require regenerated routes and separately configured server secrets.

Only explicitly named public catalog models permit anonymous reads. Orders, appointments (including patient records), subscriptions, accounts, inquiries, enrollments and comments remain private. Unpublished posts are excluded from public list/detail/homepage output. The SaaS homepage no longer dumps accounts through its direct Prisma query.

Generated mutations now allow only declared scalar fields, require non-default fields on creation, reject nested Prisma operators and managed fields, validate identifiers and numeric/date types, enforce JSON and a 64 KiB streamed body limit, and map database failures without leaking internal messages. Responses disable caching and lists cap at 100 rows. Project-name quoting no longer breaks generated JavaScript/JSX.

Tests execute emitted handlers against a recording Prisma substitute for every category, including unauthorized and read-only mutations, private reads, mass assignment, body limits, invalid types, draft visibility and safe errors. Generated JavaScript/JSX is parsed for all categories. This is not a real Next.js/Prisma deployment test, employee RBAC, payment processing, stock validation, reservation concurrency control or protection for an unrelated API added later. Administrative CRUD still requires dedicated domain transactions before it can power a public checkout or booking flow.

Local follow-up validation: 2,241 backend tests, 2,240 passed, zero failures, one real-Mongo test skipped locally and delegated to the existing CI service. The 17 new security tests execute generated handlers and parse generated code. No live AI provider transport was used.

## Self-service project administrator login

Generated full-stack applications now include `/login`, `/admin`, and same-origin login/logout/session handlers. During generation, the scaffold supplies the platform authentication URL, signed public project identity and an owner-dashboard setup link automatically. These are routing metadata, not administrator credentials. The operator does not enter a customer's password or distribute a service API key.

First-use/recovery flow: the customer follows the setup link, authenticates to their JAOLA owner account, and sets the project password using the existing owner-protected endpoint. The link alone grants no rights. The dashboard checks both owner and project, preserves the pending target through sign-in, and the server enforces ownership again. Returning to the application, the customer enters the project password on `/login`. The existing bcrypt/versioned project credential store remains the single authority.

The generated server exchanges the password with JAOLA and sets an HttpOnly, SameSite=Strict cookie, with Secure and a __Host prefix in production. Session checks are bound to the signed project identity and the existing credential version; owner password recovery invalidates previous sessions. Cookie-authenticated writes, login and logout require a matching Origin. Integration service keys remain optional and separate. Logout removes the browser cookie; credential reset revokes all project sessions. A copied token is otherwise subject to its one-hour expiration. No employee accounts or email-recovery mechanism are claimed.

Private data is not embedded in the administrator page shell. Responses and auth requests disable caching; history restoration reloads the session check. Failure to reach JAOLA fails closed. Therefore platform availability and persistent platform credential storage remain required. The platform's PUBLIC_BACKEND_URL (or Render external URL) and optional FRONTEND_URL provide deployment routing. Existing generated apps require regeneration/redeployment; this change does not deploy customer apps or convert static deployment configuration into a Next.js hosting setup.

Validation adds an actual generated Next/SQLite build and HTTP smoke flow in CI (the platform auth HTTP boundary is stubbed there). Separate local tests use the real platform password/session functions to verify correct passwords, project isolation, revocation after owner reset, cookie flags, CSRF rejection, service outages and owner-only setup navigation.

Local verification: 2,246 backend tests discovered, 2,245 passed, zero failures, one real-Mongo test skipped locally. The platform frontend production build passed. Generated Next/SQLite execution is separately gated in CI; no customer production deployment was performed.

The first generated-app HTTP run caught a Next proxy-origin mismatch after a successful production build. Origin checking now compares the browser Origin with the request Host authority, rejects foreign/opaque origins and insecure non-loopback production origins, and does not trust arbitrary forwarded-host values. A regression test covers this deployment case.
