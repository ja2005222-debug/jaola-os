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
