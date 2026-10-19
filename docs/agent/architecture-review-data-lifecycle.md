{{REVIEW_PREAMBLE}}

Trace important data from creation through transformation, storage, failure,
and cleanup. Reconstruct state transitions and check who owns each mutation,
which invariants are enforced at each boundary, and whether errors preserve
enough context for the caller to recover. Prioritize leaks, stale state,
partial updates, lost errors, and lifecycle paths that are demonstrably
reachable.

## Checklist

- [ ] Enumerate the meaningful states and transitions from creation through successful completion.
- [ ] Check initialization, normal mutation, failure, retry, rollback, and cleanup paths.
- [ ] Identify the owner of every mutation and the invariant that owner must preserve.
- [ ] Check for partial updates, stale cache entries, lost ownership, and recovery paths that leave inconsistent state.
- [ ] Check that identity, invalidation, and lifetime keys cover every input that affects stored data.
- [ ] Verify that errors retain enough context for the caller to choose a safe next transition.
- [ ] Reproduce the defect with an observable before-and-after state, not with a style preference.

Do not report a mutable field merely because it is mutable. Report it only when
an observable transition can leave inconsistent state or bypass a required
invariant.

For every suspected defect, write the affected state before and after the
operation and identify the owner responsible for restoring consistency after a
failure. Check normal, error, retry, and cleanup paths. Do not combine separate
state machines into one finding unless they share the same broken invariant.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

