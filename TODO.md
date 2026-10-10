# UI overhaul TODO

Remaining work, ordered by priority. See [UI milestones](UI_MILESTONES.md) for acceptance criteria and [the test plan](TEST_PLAN.md) for verification steps.

## List loading and refresh

- [x] Add skeleton loading to inventory.
- [x] Add skeleton loading to tasks.
- [x] Add skeleton loading to groceries.
- [x] Keep existing list content visible during refresh.
- [x] Preserve filters, layout selection, and focus while refreshing.
- [x] Retain previous data when refresh fails and provide a retry action.

## Feedback and dialogs

- [x] Improve empty states with useful next-action buttons.
- [x] Make remaining loading errors and retry actions consistent.
- [x] Polish dialog entrance and exit animations with reduced-motion support.
- [x] Verify focus returns to a useful control when dialogs close, including after deletion.

## Next: mobile and accessibility

- [ ] Review mobile card spacing, touch targets, and long text.
- [ ] Check graph labels and layouts at narrow widths and 200% zoom.
- [ ] Review keyboard navigation and visible focus across core workflows.
- [ ] Verify screen-reader announcements and color contrast.
- [ ] Check reduced motion across every animated surface.
- [ ] Check animation performance with a large inventory.

## Before merging

- [ ] Complete the pending browser checks in [TEST_PLAN.md](TEST_PLAN.md).
- [x] Run the full test suite: `npm.cmd test`.
- [x] Run lint: `npm.cmd run lint`.
- [x] Run type checking: `npm.cmd run typecheck`.
- [x] Run the production build: `npm.cmd run build`.
- [x] Record results and update milestone statuses for the final revision.
