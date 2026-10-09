# StockHome UI overhaul

The theme and dashboard data foundation are complete. These milestones focus on how the interface moves, responds, and feels during everyday use.

See [the branch test plan](TEST_PLAN.md) for fixtures, manual acceptance cases, automated commands, and the merge checklist.

## Milestone 1 — Dashboard motion

Status: implemented; automated checks passed. Browser visual review pending.

- Stagger the summary cards as dashboard data arrives.
- Fade and gently raise the dashboard heading, graph, and detail cards on entry.
- Give clickable summary cards a subtle lift, shadow, and press response, including keyboard focus feedback.
- Reveal chart bars on entry and ease their width changes when switching graph views.
- Respect the system's reduced-motion preference and keep all content immediately available without animation.

Done when: existing dashboard interactions and data tests pass, type checking and lint pass, the production build succeeds, and motion styles are scoped to the intended elements. Browser checks should cover initial loading, refresh, graph filters, keyboard focus, and reduced motion.

Verification: the five dashboard and graph component tests passed, along with ESLint, TypeScript, and the production build. Motion is defined only under `prefers-reduced-motion: no-preference`; visual timing and feel still need review in a browser.

## Milestone 2 — Inventory, tasks, and groceries

Status: implemented; automated checks passed. Browser visual review pending.

- [x] Extend staggered entrances to inventory cards, tasks, groceries, and restock suggestions.
- [x] Add dismissible, politely announced confirmations after successful saves, completions, purchases, deletions, and clipboard copies.
- [x] Animate remaining rows into their new positions after list changes. Keep stable keys and restore keyboard focus when a checkbox action moves or removes a row.
- [x] Cap stagger delays at 200 ms; respect reduced motion for entrances, row movement, and completion marks.

Task and inventory saves update the returned record in place. Failed writes keep the previous selection, leave forms open with an error, and never announce success. Notifications remain available until dismissed or replaced by the next action.

Verification: 12 focused tests cover saved feedback, failed writes and retries, deletion confirmation, grocery purchases and clipboard copying, focus preservation, animation cleanup, and reduced motion. ESLint, TypeScript, and the production build passed.

Done when: create, edit, complete, purchase, and delete flows remain responsive; failed saves preserve the previous state; motion also works with keyboard navigation and reduced motion.

## Milestone 3 — Loading and feedback

Status: in progress. Dashboard skeleton loading, refresh retention, and action feedback are implemented; list loading states and dialog refinements remain planned.

- [x] Add layout-matched dashboard skeletons, with reduced-motion support.
- [x] Keep dashboard cards, chart filters, and previous values visible during refresh; retain cached values on temporary errors and show a retry message.
- [ ] Add skeletons and smoother refresh to list loading states.
- [x] Add save and completion confirmations; show save/delete failures inside the relevant dialog.
- [ ] Refine remaining retry and empty-state feedback.
- Refine dialog entrances and exits using the existing dialog primitives.

Done when: slow connections and failed requests have clear feedback without unnecessary layout jumps, repeated announcements, or blocked interaction.

## Milestone 4 — Mobile and accessibility polish

Status: planned.

- Review card density, chart labels, touch targets, and long text on narrow screens.
- Audit focus visibility, dialog focus return, screen-reader announcements, and color contrast.
- Check reduced motion across all animated surfaces.
- Check animation performance with a large inventory and remove effects that make the app feel slower.

Done when: core workflows have been checked on desktop and narrow mobile layouts with pointer, touch, keyboard, and reduced-motion settings.

## Motion guidelines

- Prefer short opacity and transform animations; avoid moving surrounding layout.
- Use roughly 160–200 ms for interaction feedback and 360–600 ms for entrances.
- Keep stagger delays under 250 ms and animations finite.
- Animate meaningful state changes; do not delay navigation or saving to finish an effect.
- Preserve accurate values throughout animations; no decorative count-up numbers.
- Use shared CSS motion classes first; introduce another dependency only if a later milestone needs it.
