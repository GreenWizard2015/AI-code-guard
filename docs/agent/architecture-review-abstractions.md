{{REVIEW_PREAMBLE}}

Find repeated concepts that already have domain meaning: identity, state,
validated values, lifecycle transitions, or ownership boundaries. Propose a
domain object, interface, protocol, or value object only when it can own an
invariant and remove branching, duplicated validation, or leaked structure
from its callers. Prefer renaming an existing concept when a new type would
not own behavior.

The review may recommend introducing a domain abstraction when it measurably
improves the codebase: it should centralize a real domain rule, clarify
ownership, reduce invalid states, or make the existing behavior easier to
verify. Explain the improvement and the concrete invariant it would own; do
not propose abstractions merely to increase the number of classes.

Do not report the absence of a class by itself, a class-versus-function
preference, or a generic wrapper as a defect. Report the defect when the
current representation leaves a real invariant or domain rule duplicated,
leaked, or owned by unrelated callers. In that case, propose the smallest
domain abstraction that would own the rule and explain the concrete reduction
in duplication, invalid states, or coupling.

For every suspected defect, name the invariant or domain rule that is currently
owned by callers, list the duplicated or leaked representation, and show which
single object could own it. Check construction, validation, and lifecycle use
before proposing a type. Reject a proposed abstraction if it only shortens a
call site or adds a forwarding layer.

## Checklist

- [ ] Identify repeated concepts that carry identity, validation, state, lifecycle, or ownership meaning.
- [ ] Check whether callers duplicate the same invariant, conversion, validation, or branching logic.
- [ ] Check whether raw primitives or structural records leak across a boundary that needs a domain contract.
- [ ] Determine whether an existing type can be renamed or extended before proposing a new abstraction.
- [ ] Verify that the proposed object owns behavior and an invariant instead of only forwarding calls.
- [ ] Check construction, valid states, invalid states, and lifecycle transitions of the proposed abstraction.
- [ ] Reject the proposal if it only shortens a call site, increases indirection, or creates a generic wrapper.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

