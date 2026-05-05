<!--
Thanks for the contribution! Fill out the sections below — the BMAD spec docs
in /docs are the source of truth, so referencing them in your PR makes review
fast.
-->

## Summary

<!-- One or two sentences: what changes and why. -->

## BMAD traceability

- Story: <!-- e.g. docs/stories/E2.S3-post-todos.md -->
- Requirements touched: <!-- FR/NFR ids from docs/prd.md §2 -->

## Changes

<!-- Bullet points; one per coherent change. -->

-

## Test plan

<!-- Tick all that apply and add notes. The QA gates from docs/qa/ apply. -->

- [ ] `npm run lint` is green
- [ ] `npm test --workspace=backend` is green (incl. coverage gate ≥ 80% lines)
- [ ] `npm test --workspace=frontend` is green
- [ ] `npm run e2e` is green locally (or N/A — explain)
- [ ] New / updated tests cover the new behaviour
- [ ] No new `console.error` in normal happy-path operation
- [ ] No new `TODO` / `FIXME` without a linked issue

## Screenshots / recordings (UI changes only)

<!-- Drag and drop here, or paste links. -->

## Risk & rollback

<!-- What's the blast radius? How do we revert if it breaks? -->

## Reviewer checklist

- [ ] Spec alignment: behaviour matches the linked story / PRD requirement
- [ ] Code style: typed end-to-end, no string-concatenated SQL, no `dangerouslySetInnerHTML`
- [ ] Security: no secrets, no permissive CORS, no leaking error details
- [ ] A11y (UI changes): keyboard reachable, accessible names on icon-only controls
