# JAOLA OS — Build Intelligence Execution Roadmap

Status: Approved for implementation planning  
Recorded: 2026-09-11  
Scope: Chat, Router, Site/System tracks, Agents, Plugins, Verification, Memory, AI providers, and deployment gates

## Product outcome

### Arabic understanding checkpoint — 2026-09-12

Implemented: Arabic semantic routing guidance (dialects, mixed Arabic/code, negation, deferred requests, ambiguous references); preservation of the original constrained request in execution instructions; an explicit clarification response that cannot be promoted into an edit by the imperative/repetition fallback; and a narrow dialectal correction for `صلح الطلبات بس ما تغير الأسعار` in question detection. The original text is preserved separately from normalization. Existing Arramooz data remains in use without duplication.

Validation scope: deterministic regression tests with injected model responses verify safety and data preservation. They do not measure the live model's Arabic understanding accuracy.

Reference-memory checkpoint: pending original request and clarification question now persist in project memory. A typed answer is resolved against that context before generic intent handling. Bare consent repeats the question; cancellation and expiry prevent execution; concurrent answers consume the reference at most once within a server process. Atomic recovery across crashes/multiple server processes remains unimplemented.

Evaluation checkpoint: `tests/fixtures/arabicEvaluation.mjs` contains 60 authored seeds across six categories and five whitespace variants each (300 records, not 300 independent semantic examples). Labels require human Arabic/product review. The offline scorer measures action agreement, missing predictions, unsafe execution, and unnecessary clarification. Seed families must remain together in any train/test split. No external model evaluation has been performed.

Remaining Arabic work: broaden and human-review the evaluation corpus (including richer dialect and multi-turn coverage); versioned domain vocabulary and user-confirmed commercial requirements; actual model accuracy measurement. Evaluation with an external AI provider requires separate authorization; it is not part of automated unit tests.

Implementation checkpoint: the initial gate now intercepts `executeMission` before queueing. It persists a project-scoped pending goal and accepts a typed Site/System answer, guidance, or cancellation through the existing chat. Confirmed choices resume the original goal. The registry contract is extensible; the chat answer adapter currently supports Site/System only. Structured buttons, atomic crash-safe resume, full Build Contracts, and separate track pipelines remain subsequent work. This checkpoint does not claim those later workstreams are complete.

JAOLA must turn a user request into a complete, verifiable product without silently guessing decisions that could materially change the result. The system should understand the project context, select the correct build path, ask the user only when a consequential ambiguity remains, verify the result against explicit acceptance criteria, and deploy only after all required gates pass.

## Non-negotiable decision rule

JAOLA may infer reversible, low-risk details when confidence is high and the inference does not change the product category, data model, security model, cost, deployment target, or existing project identity.

JAOLA must pause and ask the user a direct question before execution when two or more plausible interpretations would produce materially different results.

### Mandatory clarification cases

- Site versus internal/business system is unclear.
- Create, edit, rebuild, replace, delete, or deploy intent is unclear.
- The request could replace an existing template, architecture, or working feature.
- Authentication, roles, permissions, tenancy, or data visibility is unspecified and affects access control.
- A destructive or difficult-to-reverse action is requested.
- Database schema or migration choices risk existing data.
- A paid external service, plugin, provider, or deployment target would be selected.
- Required credentials, compliance constraints, locale, currency, or business rules are missing.
- The selected template or strategy is below the configured confidence threshold.
- The user's request conflicts with saved project decisions or the current codebase.

### Mandatory project-type question at build start

For every new build request, the Router must resolve the project type before selecting a template, strategy, agent team, plugin set, data architecture, or deployment target.

If the type is not explicit in the user's request and cannot be established from a previously user-confirmed project decision, JAOLA must pause and ask:

> ما نوع المشروع الذي تريد بناءه؟
>
> - موقع ويب — صفحات عامة، محتوى، تسويق، حجوزات، متجر أو خدمات للعملاء.
> - سيستم داخلي — مستخدمون وصلاحيات، بيانات، عمليات وتقارير لإدارة العمل.

No build stage may start until the user selects a type. Keyword matches, template similarity, the current UI tab, or an AI guess are not sufficient substitutes for a user answer when intent is ambiguous.

The selected type must be persisted as a `user-confirmed` project decision and attached to the Build Contract and mission. Subsequent edits and rebuilds reuse it unless the user explicitly requests a type change; changing it requires confirmation because it can materially alter architecture and data handling.

### Extensible project-type registry

The Site/System choice is the first version of a configurable project-type registry, not a permanent two-option conditional. Each registered type must declare:

- stable ID, localized label, description, and examples;
- detection signals and minimum confidence threshold;
- required and optional Build Contract fields;
- compatible templates, strategies, agents, plugins, and providers;
- mandatory stages and verification policies;
- supported deployment targets and infrastructure requirements;
- clarification option visibility and ordering; and
- migration/compatibility rules when changing from one type to another.

Future types such as mobile app, API/service, automation/workflow, data dashboard, or AI agent may be added through the registry without rewriting the core Router. The Router presents only enabled types relevant to the request, while always retaining a safe `غير متأكد — ساعدني في الاختيار` path that triggers a short guided question instead of execution.

### Clarification interaction contract

1. Ask one concise question at a time unless tightly related choices must be decided together.
2. Present two or three concrete options and recommend one with a short reason.
3. Explain the consequence of each option in plain language.
4. Do not modify files, schema, project identity, or deployment until the answer is recorded.
5. Persist the confirmed answer in project memory as a user decision, not an AI inference.
6. Resume from the paused plan without re-running unrelated completed work.
7. If the user explicitly delegates the decision, record that delegation and choose the safest reversible option.

## Target routing flow

1. Load authenticated user and project-scoped context.
2. Classify operation: build, edit, fix, rebuild, delete, stop, or deploy.
3. Resolve product type from an explicit request or a previously user-confirmed decision.
4. If unresolved, pause and ask the mandatory project-type question; do not execute.
5. Extract requirements, constraints, entities, roles, integrations, and acceptance criteria.
6. Compare the request with project memory and current repository state.
7. Calculate confidence and identify consequential ambiguities.
8. If further clarification is required, create a paused decision state and query the user.
9. Produce a versioned Build Contract.
10. Select the strategy, agents, plugins, provider, and delivery stages.
11. Execute through verification and deployment gates.
12. Record outcomes and quality signals for future routing decisions.

## Implementation workstreams

### P0 — Semantic Router and User Clarification Gate

- Introduce structured intent and confidence output rather than keyword-only selection.
- Separate operation intent from product-domain classification.
- Add `needsClarification`, `ambiguities`, `options`, and `recommendedOption` to the routing contract.
- Add a resumable `AWAITING_USER_DECISION` mission state.
- Add an API/UI response type for direct questions and selectable answers.
- Add the mandatory Site/System question when a new build has no explicit or user-confirmed project type.
- Implement project types through an extensible registry rather than hard-coded Router branches.
- Prevent execution stages from starting while a required decision is unresolved.
- Store confirmed decisions with provenance: `user-confirmed`, `inferred`, or `system-default`.
- Add Arabic and English ambiguity regression suites.

Acceptance criteria:

- Bare rebuild commands preserve the current project identity.
- Ambiguous Site/System requests do not start building.
- The first ambiguous build request always presents the project-type question before template or strategy selection.
- Newly registered project types can participate in clarification, routing, execution, and verification without changing core Router code.
- Destructive, schema, security, cost, and deployment decisions require confirmation.
- A confirmed answer resumes the same mission exactly once.
- No duplicate builds occur after reconnect or repeated answer submission.

### P0 — Versioned Build Contract

- Define product type, roles, pages/modules, entities, workflows, integrations, security requirements, deployment target, and acceptance criteria.
- Validate agent outputs against the contract after every material stage.
- Version contract changes and distinguish user-approved scope changes from agent refinements.

Acceptance criteria:

- Every non-trivial build has a machine-readable contract.
- Final verification reports fulfilled, partial, and missing requirements.
- Deployment is blocked when critical acceptance criteria are missing.

### P0 — Real Site/System Architecture Split

- Site track: content, UX, forms, SEO, accessibility, frontend performance, and static/serverless deployment.
- System track: domain model, authentication, authorization, tenant isolation, database, APIs, auditability, and persistent backend deployment.
- Give each track its own required agents, stages, tests, plugins, and deployment policy.

Acceptance criteria:

- Track selection changes the pipeline, not only template filtering.
- System projects cannot pass without authorization and tenant-isolation checks where applicable.
- Site projects cannot pass without link, form, responsive, accessibility, and SEO checks.

### P1 — Strategy and Template Scoring

- Score candidates by track, domain, capabilities, data model, stack, deployment compatibility, and confidence.
- Record selection and rejection reasons.
- Use custom generation when no candidate exceeds the threshold.
- Keep plugin guidance outside the semantic template-matching input.

### P1 — Verification and AutoFix Gates

- Add user-flow, browser-console, API, database, auth, responsive, accessibility, and deployed-smoke tests.
- Map every AutoFix change to a failed check and rerun that check.
- Limit repair loops and escalate unresolved failures with evidence.
- Require post-deployment health verification before declaring success.

### P1 — Capability-Based Agent Router

- Select only the agents required by the Build Contract and risk profile.
- Define typed inputs, outputs, timeouts, retry rules, and ownership for each task.
- Run independent tasks concurrently and serialize tasks with data or file dependencies.
- Maintain a single mission state and an auditable decision trail.

### P1 — Plugin SDK and Lifecycle

- Define plugin manifests, capabilities, compatible tracks, permissions, configuration schema, and version compatibility.
- Expand lifecycle hooks to analysis, planning, schema, build, verification, and deployment.
- Isolate plugin failures, enforce timeouts, and expose every plugin contribution in the mission log.
- Require contract tests before a plugin can participate in production builds.

### P2 — Project Memory and Decision Provenance

- Persist confirmed requirements, architecture decisions, stack, schema, integrations, acceptance criteria, stable release, and unresolved risks.
- Never treat an AI inference as a user-confirmed fact.
- Detect conflicts between new instructions, saved decisions, and repository state.

### P2 — AI Provider Quality Scorecard

- Measure correctness, test pass rate, repair count, latency, cost, contract adherence, and language/context performance by task type.
- Route tasks by demonstrated performance and availability.
- Preserve fallbacks without allowing silent quality degradation.

### P2 — Outcome Feedback Loop

- Capture selected strategy, failures, fixes, user reversals, deployment result, and post-build edits.
- Use aggregate evidence to improve thresholds, templates, provider routing, and agent selection.
- Keep learning signals tenant-safe and free of secrets.

## Required cross-cutting safeguards

- Authentication and project ownership checks on every project read/write path.
- Idempotency keys for builds, answers, retries, and deployment requests.
- Optimistic concurrency or version checks for project memory and Build Contracts.
- Structured logs with mission, project, user, stage, agent, provider, plugin, and decision IDs.
- Resource budgets for time, tokens, repair attempts, and external service cost.
- Rollback to the last verified project snapshot.

## Recommended delivery order

1. Semantic Router contract and mandatory clarification policy.
2. Paused/resumable user-decision state and chat UI.
3. Versioned Build Contract.
4. Separate Site/System pipelines and acceptance suites.
5. Verification and deployment gates.
6. Strategy scoring and capability-based agent routing.
7. Plugin SDK hardening.
8. Memory provenance, provider scorecards, and feedback learning.

## Definition of done

This roadmap is complete only when JAOLA can demonstrate, through automated tests and mission logs, that it:

- does not guess consequential requirements;
- asks the user before materially divergent or irreversible execution;
- resumes safely after receiving an answer;
- preserves user, project, and template identity;
- builds against explicit acceptance criteria;
- verifies behavior rather than only compilation;
- selects agents, plugins, and providers based on the task;
- blocks deployment on critical failures; and
- verifies the deployed product before reporting success.
