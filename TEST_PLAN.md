# UI enhancements test plan

Branch: `feat/ui-enhancements`

Scope: dashboard data and graph, dashboard and list skeletons, retained list refresh and retries, useful empty states, dialog motion and focus return, action feedback, inventory/task/grocery list motion, keyboard focus, and reduced motion.

## Current verification status

- The milestone 3 update passed 73 tests, lint, type checking, and the production build.
- Dashboard loading, refresh, and graph tests passed during the preceding dashboard change.
- Browser checks below are **pending**. Unit tests do not establish visual quality, real screen-reader behavior, or persistence against Supabase.
- Automated loading checks cover inventory layout skeletons, tasks, groceries, initial restock loading, and grocery refresh failure/retry with retained rows.
- The clipboard-format assertion now matches the intended `[ ] Rice: 2 kg` checklist output.

### Milestone 3 browser smoke results — 2026-10-09

Headless Edge 154.0.4258.62, development server, 1280 × 900 and 390 × 900. All six page/viewport combinations passed: Inventory, Tasks, and Groceries/Restock at each width. Requests and authentication were mocked in an isolated browser profile; no live account records were changed.

- Initial requests display skeletons without premature empty states.
- Delayed and failed refreshes retain the same row elements and keyboard focus; Retry recovers.
- Dialog entrances compute to 180 ms; Escape restores the opener, and successful deletion restores focus to the primary Add control.
- With reduced motion enabled, the inventory dialog computes to no animation.
- No horizontal page overflow was detected at either width.

These focused checks cover milestone 3 UI behavior. They do not replace the full P0 persistence checks against Supabase, screen-reader review, or the milestone 4 mobile/accessibility audit below.

## Setup

1. Use a dedicated test account with disposable records and the existing grocery and backup migrations applied.
2. Start the app with `npm.cmd run dev` and sign in. Also run the final smoke test against `npm.cmd run build` followed by `npm.cmd start`.
3. Use desktop Edge or Chrome, a narrow mobile viewport, and Firefox if available. Record the browser/version used.
4. Have browser tools available for network throttling, request blocking, and reduced-motion emulation.
5. Reset the fixture between independent cases that change or delete records. Dates below are relative to the test device's local date.

### Suggested fixture

| Inventory item | Status | Quantity | Category | Expiry |
| --- | --- | --- | --- | --- |
| Rice | Available | 2 kg | Food & cooking | In 7 days |
| Milk | Low stock | 1 L | Drinks | Today |
| Coffee | Unavailable | 0 bags | Drinks | None |
| Soap | Available | 3 bars | Cleaning & laundry | None |
| Bread | Low stock | 1 loaf | Food & cooking | Yesterday |
| Batteries | Unavailable | 0 packs | Other | In 8 days |

Tasks: Wash dishes (open, today), Take out bins (open, yesterday), Vacuum (open, in 7 days), Sort drawer (open, no date), Water plants (completed, yesterday).

Groceries: Rice (2 kg, not purchased), Milk (1 L, not purchased), Soap (1 bar, purchased).

Expected dashboard baseline: 6 inventory items, 2 available, 2 low stock, 2 unavailable, 2 expiring soon, 1 past expiry, 4 pending tasks, 1 overdue, 1 due today, 20% task completion, and 2 grocery items remaining.

## P0 — Core behavior and data accuracy

| ID | Steps | Expected result |
| --- | --- | --- |
| D01 | Open Dashboard using the fixture. | Summary counts match the baseline. Graph counts distinct records, not summed quantities. Completed tasks are excluded from overdue counts. |
| D02 | Select **Needs restock**, then **All stock**. Follow a graph legend link. | Graph shows the appropriate statuses and counts. Legend links open the corresponding inventory filter. |
| D03 | Enable slow network throttling; navigate to Dashboard from another page. | Skeletons occupy the summary, graph, progress, and detail-card areas. A loading announcement is present. No false zero counts or premature empty states appear. Skeletons disappear after loading. |
| D04 | Load Dashboard, select **Needs restock**, scroll down, then trigger **Refresh dashboard** with throttling enabled. | Existing cards, counts, and graph remain visible. No skeleton replacement or repeated card entrances. The selected graph view survives. A refresh indicator appears and the refresh button is disabled until completion. |
| D05 | Change a record in a second tab; refresh Dashboard in the first. | Updated counts arrive without blanking the dashboard. The last-full-update timestamp advances after all sections succeed. |
| D06 | After loading Dashboard, block requests matching its inventory REST endpoint; refresh. | Existing inventory values remain visible with an error and stale-data explanation. Working sections can update. The last-full-update timestamp does not advance. Unblock and retry; the error clears and values update. |
| D07 | Block grocery REST requests before the first dashboard load. | Other dashboard sections work. Grocery data is marked unavailable, not reported as zero. |
| I01 | Add an inventory item, then edit its name and quantity. | Each successful save closes the dialog, updates the list without a full reload, and displays the saved item's name in a confirmation. Reload the page to verify persistence. |
| I02 | Open an inventory edit dialog; block inventory REST writes; save. | Error appears inside the dialog. Entered values remain available, the original card remains unchanged, and no success notification appears. Unblock and retry successfully. |
| T01 | Add and edit a task. Try a title containing only spaces. | Valid saves update the list and show confirmations. Whitespace-only titles are rejected without writing or announcing success. |
| T02 | In Todo, complete a task; in Completed, mark it not done. Repeat in All. | State changes only after a successful response. Counts and list membership update correctly, with completion/reopening messages. Reload to verify persistence. |
| T03 | Throttle requests and rapidly activate a task checkbox. Then repeat with task REST writes blocked. | Duplicate writes are prevented while pending. Failure keeps the previous selection and shows an error without a completion notice. Controls become usable again. |
| G01 | Add and edit a grocery item, mark it purchased, then uncheck it. | Confirmations identify the item. It moves between To buy and Purchased. Its shopping quantity persists. Inventory quantities are unchanged. |
| G02 | Block grocery REST writes and attempt a purchase or save. | Purchase selection remains unchanged; save errors remain in the form. No false success message. Unblock and retry. |
| X01 | Open a delete dialog for a task, inventory item, and grocery item. Cancel first, then confirm. | Cancel makes no deletion request. Confirmation deletes only the chosen record and shows a success message. A failed delete leaves its dialog open with an error. |
| X02 | In Completed tasks, use **Clear completed**. | Confirmation is required. Only completed tasks are removed; pending tasks remain. The notification reports the number actually deleted. |
| C01 | Use **Copy remaining**, then paste into a plain-text editor. | Current format is `[ ] Name: quantity unit`, one item per line. Purchased items are excluded. Copy success is announced only after copying succeeds. |
| A01 | Refresh after signing out, then sign in as a different test account. | Signed-out access redirects to login. The second account never receives or retains the first account's records. |

## P1 — Motion, feedback, and accessibility

| ID | Steps | Expected result |
| --- | --- | --- |
| M01 | Open Dashboard and each list page with several records. | Entrances are short and staggered. Large lists do not accumulate long delays; stagger is capped at 200 ms. Data values are accurate throughout. |
| M02 | Add/remove items, change inventory layouts, and switch task filters. | Existing rows move smoothly where their positions change; newly appearing rows enter gently. Interactions do not wait for an animation to finish. |
| M03 | Complete a task in All and purchase a grocery item. | Completion marks have brief visual feedback. Completed/purchased styling changes clearly. A row filtered out of the current view leaves promptly. |
| M04 | Enable reduced motion before opening the page; repeat entrances, layout changes, and completions. | No card rise, stagger, skeleton pulse, row movement, or completion pop. Content and controls work immediately. |
| F01 | Trigger a successful action; dismiss its notification. Repeat the action. | Notification is readable and dismissible, remains until dismissed or replaced/cleared by the next action, and can announce a repeated action again. |
| F02 | Use keyboard navigation to complete the only Todo task, then repeat with several tasks. | Focus moves to Add task when the list becomes empty, or to a remaining task checkbox otherwise. In All, focus stays on the same task. |
| F03 | Use Space on a grocery checkbox to purchase and unpurchase it. | Focus follows the same item's checkbox into its new section. Tab navigation continues normally. |
| F04 | Start a slow checkbox update, then deliberately move focus to another available control. | Completion does not steal focus back from that control. |
| F05 | With a screen reader, save an item, cause an error, and dismiss a notification. | Success is announced politely; errors are discoverable in the active dialog or page. Decorative animation and skeletons do not produce extra announcements. |
| F06 | Deny clipboard permission where supported; use Copy remaining. | A useful error appears and no successful-copy notification is shown. |
| R01 | Check at 375 × 812, 768 × 1024, and 1440 × 900; repeat at 200% browser zoom. | No horizontal page overflow. Long names wrap, dialog actions remain reachable, graph labels remain readable, and notifications fit the viewport. |
| R02 | Use long names, empty lists, and at least 50 inventory items. | Empty states are accurate. Animations remain responsive, notification text wraps, and later list items are not held back by increasing delays. |

## Automated checks

Run from the repository root on Windows:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Focused checks for this iteration:

```powershell
npm.cmd test -- tests/action-feedback.test.tsx tests/animated-list.test.tsx tests/inventory-list.test.tsx tests/dashboard.test.tsx tests/dashboard-stock-chart.test.tsx tests/dashboard-utils.test.ts tests/loading-status.test.tsx
```

Coverage is in:

- `tests/action-feedback.test.tsx`: save success/failure/retry, confirmed deletion, task completion, grocery purchase focus, clipboard success.
- `tests/animated-list.test.tsx`: retained focus during reordering, animation cleanup, reduced-motion behavior.
- `tests/inventory-list.test.tsx`: card details/actions, layout preference persistence, loading state.
- `tests/dashboard.test.tsx`: paging, initial skeletons, retained refresh, graph filter persistence, request failures, account changes.
- `tests/dashboard-stock-chart.test.tsx` and `tests/dashboard-utils.test.ts`: graph filtering, empty states, counts, dates, category grouping.
- `tests/loading-status.test.tsx`: varied initial messages, rotation, timer cleanup.
- `tests/tasks-loading.test.tsx`: retained refresh, retry, account changes, stale responses, empty-state actions, and dialog/refresh focus.
- `tests/grocery-feedback.test.tsx`: retry focus, refresh guards and focus, empty-state actions, unavailable inventory suggestions, and deletion focus.
- `tests/dialog.test.tsx`: latest opener restoration, removed/disabled opener fallback, and explicit focus overrides.

These tests mock Supabase or exercise pure calculations. Run the P0 browser persistence checks against the test account as well.

## Merge checklist

- [x] Reconcile the clipboard-format assertion with the intended checklist output.
- [ ] Full automated checks pass on the final branch revision.
- [ ] All P0 checks pass, including reload-based persistence and failed-write recovery.
- [ ] Desktop, narrow mobile, keyboard, and reduced-motion checks pass.
- [ ] Any remaining P1 issue is recorded with reproduction steps and disposition.
- [ ] Record browser/version, viewport, test date, revision, case IDs, and results.

Result format: `Case ID | Pass/Fail/Blocked | Browser + viewport | Revision | Evidence or reproduction steps`.
