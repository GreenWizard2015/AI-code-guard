{{REVIEW_PREAMBLE}}

Trace the main use cases from entry points to side effects. Check whether each
responsibility has one clear owner, whether dependencies point toward stable
contracts, and whether modules expose more state or behavior than their
callers need. Prioritize boundary crossings that make behavior impossible to
test, replace, or reason about locally.

## Checklist

- [ ] Trace at least one important use case from its entry point to its side effects.
- [ ] List the modules crossed by that use case and identify the owner of each responsibility.
- [ ] Check that dependencies point toward stable contracts rather than volatile implementations.
- [ ] Check for concrete lower-layer dependencies, dependency cycles, and leaked implementation details.
- [ ] Check whether public inputs, outputs, and errors are narrower than the internal representation.
- [ ] Verify that the suspected boundary problem blocks a real replacement, test, or local change.
- [ ] Record the importer, consumer, and reproducible behavior before creating a finding.

For every suspected defect, trace at least one importer and one downstream
consumer. Confirm the direction of the dependency, the public surface that
crosses it, and the concrete change that becomes harder or unsafe. Prefer one
finding for one broken boundary, with the smallest affected dependency chain.

Do not report a file-size preference, a naming preference, or a dependency that
is justified by the domain. Report a boundary defect only when the code shows
an observable coupling, duplicated responsibility, broken substitution, or
blocked change path.

{{REVIEW_FINDING_RULES}}

{{ALLOWED_OPERATIONS}}

