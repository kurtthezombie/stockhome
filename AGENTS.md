<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StockHome development instructions

## Project and stack

StockHome manages household inventory, tasks, groceries, and account backup/restore.

- Next.js 16 App Router, React 19, and TypeScript with strict checking.
- Tailwind CSS 4, shared shadcn/Radix UI primitives, and Hugeicons.
- Supabase JavaScript client for authentication, PostgreSQL data access, and database RPCs.
- PostgreSQL constraints, grants, and row-level security (RLS) enforce data integrity and account isolation.
- Vitest, React Testing Library, jest-dom, and jsdom for unit/component tests; SQL scripts for database verification.
- Graphify is optional Python-based developer tooling, separate from the application runtime.

Use `package.json` and the installed framework documentation for exact versions and supported APIs.

## Architecture and file ownership

| Location | Responsibility |
| --- | --- |
| `src/app/` | App Router pages, layouts, and global styles. Keep route files focused on composing features and handling route inputs. |
| `src/components/stockhome/` | Feature components, authenticated app shell, forms, and page-level client state. |
| `src/components/stockhome/inventory/` | Inventory filters, forms, lists, grocery behavior, and related types/utilities. |
| `src/components/ui/` | Shared accessible UI primitives, loading indicators, notifications, and animation helpers. |
| `src/lib/` | Supabase client, shared utilities, and backup parsing/validation. |
| `src/types/` | Shared domain types; feature-specific types may remain beside their feature. |
| `supabase/migrations/` | Versioned database changes, RLS policies, and transactional RPCs. |
| `tests/` | Unit/component tests and disposable-database SQL tests. |

The current app calls Supabase from client features through `src/lib/supabase.ts`. There is no separate controller/service/repository backend, PHP runtime, or ORM. Extend this architecture; introduce new layers or server endpoints only when the task requires them. Use the existing `@/` import alias.

## Before editing

- Read the full request, check the working tree, and identify affected features and shared components.
- For unfamiliar features or changes spanning multiple components or database relationships, check Graphify first using the workflow below before broad source exploration. Small, clearly scoped edits can go directly to source.
- Read similar implementations and reuse existing conventions, validators, types, and helpers before adding abstractions or dependencies.
- Explain the intended change briefly. Ask for clarification when an unresolved requirement affects correctness; make routine implementation choices independently.
- Keep changes scoped and preserve unrelated work. Avoid placeholders, speculative refactors, and unsolicited TODO comments.
- Consult `UI_MILESTONES.md`, `TODO.md`, and `TEST_PLAN.md` when changing the UI overhaul work.

## React, UI, and state

- Keep state local to the feature. Use client boundaries for hooks, browser APIs, and interactive behavior; do not turn entire route trees into client components without need.
- Reuse `src/components/ui/` primitives and existing Tailwind tokens. Keep components focused and extract shared logic when actual reuse warrants it.
- Distinguish initial loading, refreshing, unavailable data, and a successfully loaded empty list. Use layout-matched skeletons initially and retain prior data during refresh or temporary errors.
- Preserve filters, layout preferences, and keyboard focus across refreshes and list updates. Clear retained account data when the authenticated user changes or the session is rejected.
- Prevent duplicate writes and stale responses from overwriting newer state. Clean up subscriptions, timers, animation handles, and request-related effects.
- Reflect successful writes using the returned database records. Do not announce success before persistence succeeds; preserve form input and previous selections on failure.
- Use safe, actionable error messages and consistent retry controls. Keep save/delete errors inside the active dialog.
- Preserve Radix semantics, labels, keyboard navigation, and focus trapping. Return focus to the opener or a useful surviving control after deletion.
- Use existing motion helpers and respect `prefers-reduced-motion`. Do not delay interaction to finish animation.
- Check narrow screens, long text, reachable dialog actions, and visible keyboard focus. Render user content as text; avoid raw HTML injection.

## Supabase, authorization, and data integrity

- Reuse Supabase Auth and the existing client. Client redirects and ownership filters are UI/query behavior; RLS and database permissions remain the authorization boundary.
- Scope account-owned reads and writes to the authenticated user where applicable. Enforce ownership in database policies, including ownership of referenced inventory records.
- Validate form inputs for feedback and enforce critical rules through database constraints or RPC validation. Treat identifiers, imported JSON, and all external input as untrusted.
- Use structured Supabase queries and parameterized SQL when needed; never interpolate user input into executable SQL.
- Add schema changes as migrations. Do not perform destructive schema changes or apply migrations to a live project without authorization.
- Use transactional database functions for operations that must succeed or roll back together. Preserve backup RPCs' `security invoker`, authenticated grants, RLS, and constrained search paths.
- Keep inventory stock quantities separate from shopping quantities. Purchasing groceries must not silently update inventory; restock suggestions must not automatically add purchases.
- Preserve backup format/version checks, 10 MB size and 10,000-record-per-list limits, explicit field validation, and linked-record validation. Never trust imported ownership or audit fields.
- Require the existing preview/confirmation flow for replacement imports and destructive UI actions. Failed multi-step imports must roll back completely.
- Use safe error messages instead of exposing SQL errors, stack traces, or internal exceptions.

## Secrets and sensitive data

- Keep credentials in environment configuration. Only the intended public Supabase URL and anon/publishable key belong in client-visible configuration; never expose service-role keys or database credentials through `NEXT_PUBLIC_*`.
- Do not commit `.env` files, credentials, tokens, or private backup exports. Do not log authentication tokens, session data, backup contents, or personal information.
- Use HTTPS for remote services; localhost development may use HTTP.
- Do not bypass authorization or weaken validation to make a test or workflow pass. Report concrete security concerns and fix those within the task's scope.

## Performance

- Optimize measured problems. Prefer readable code, existing utilities, and justified memoization over speculative caching or abstractions.
- Avoid duplicate requests and per-row database queries. Select only needed columns when practical and use pagination or database aggregation for large datasets.
- Dashboard totals must account for API row limits; do not compute complete totals from an accidentally truncated response.
- Keep cached data scoped to its account and invalidate or update it after writes. Do not introduce global state or a caching dependency without a demonstrated need.
- Use stable list keys and bounded animation delays. Consider indexed lookups and sets/maps when repeated scans become significant.

## Verification

For application changes, run relevant behavioral tests, then the required checks from the repository root:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

- Add or update tests for meaningful behavior changes, including failed requests, retries, stale responses, account isolation, or focus behavior when relevant. Avoid tests that only mirror implementation details.
- For UI changes, manually verify the primary flow and relevant keyboard, mobile, and reduced-motion behavior. Record what was actually checked; distinguish mocked browser checks from live persistence verification.
- Read `supabase/README.md` before database work. Run `tests/grocery-db.test.sql` and `tests/backup-db.test.sql` only against an empty disposable database, never a live Supabase project. Component mocks do not verify RLS.
- Documentation-only changes need a content/diff review, not an application build. Tooling changes need checks appropriate to the tools/configuration affected.
- Report unrelated failures or unavailable checks explicitly. Do not claim tests, browser checks, or deployments succeeded without evidence.
- Before finishing, review the diff for correctness, authorization, data leakage, race conditions, unnecessary queries, and accidental unrelated edits. Summarize changes, validation, and remaining limitations.

## Git and generated artifacts

- Keep commits and pull requests focused. Preserve compatibility unless the requested change requires otherwise.
- Do not manually edit generated artifacts such as `.next/`, `next-env.d.ts`, or `graphify-out/`; regenerate them with the owning tool when needed.
- Keep `.graphify-venv/` and `graphify-out/` untracked. Update dependency manifests/lockfiles together when changing dependencies.

## Graphify workflow

For exploration that benefits from a relationship map, prioritize Graphify as the first navigation step. Follow `GRAPHIFY.md` for local setup, queries, and refreshing the graph.

- Check whether the local Graphify environment and `graphify-out/graph.json` are available. When available, run the documented local extraction and clustering commands before querying to account for committed and uncommitted source changes; a matching commit alone does not establish freshness.
- Start with exact symbols or `path::symbol` queries to locate related components, consumers, tests, and schema definitions. Narrow truncated results or increase the query budget as needed.
- Inspect the returned source locations and relevant tests before making changes. Verify graph conclusions against current source; missing edges do not prove that a dependency or test is absent.
- If Graphify is unavailable or refresh fails, proceed with `rg` and direct source inspection. Do not make Graphify installation or repair a prerequisite for unrelated work. Skip it for small, clearly scoped edits.

The pilot indexes only `src/`, `tests/`, and SQL migrations using local extraction. Some test files and dynamic relationships are absent. Do not treat graph edges as proof of test coverage, runtime behavior, or authorization. Git hooks, assistant integration, and model-backed documentation processing are not part of the current setup.
