# OpenSpec-lite

Instructions for agents. The durable copy of the rules is
[`project.md`](project.md). Living truth, once folded, lives in
`openspec/specs/<capability>/spec.md`.

## Before any task

- [ ] Living truth is `openspec/specs/<capability>/spec.md`, not a SHALL in
      `changes/` or `docs/`.
- [ ] `changes/` is not a mandate. Read the disposition banner. PENDING is
      a draft. PARKED is not work. Archived means folded — do not implement it.
- [ ] Restore-only, typo, pin, comment, test-for-existing-spec: fix directly.
      Do not scaffold a change.
- [ ] New behavior: verb-led `change-id`, `proposal.md` + `tasks.md` + deltas.
      `design.md` only when cross-cutting.
- [ ] Do not start write work on PENDING or PARKED. Wait for ACTIVE BUILD
      (human activation) unless the rigor is vibe/brief and permission is already write.

## Deltas, not rewrites

```
## ADDED Requirements
### Requirement: <name>
The system SHALL …
#### Scenario: <name>
- GIVEN …
- WHEN …
- THEN …
```

MODIFIED pastes the entire living requirement, then edits. Fold replaces
that block wholesale.

## Done

Fold into `specs/`, move the change to `changes/archive/YYYY-MM-DD-<id>/`.
A fully-checked change still in `changes/` is a lie.
