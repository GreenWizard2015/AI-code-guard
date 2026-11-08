# Structural repair and analyzer checks

Read before changing ownership/API shape or shared analyzer logic. Inspect the actual rule configuration and one accepted nearby pattern, rather than guessing from rule names.

| Proposed shape | Adjacent constraints |
| --- | --- |
| Extract helper/class/module | Minimum/maximum file, class and method size; method count; placement/directory limits; stateless/singleton; unused code; proxy methods |
| Replace repeated parameters with state/request | Real owner and lifetime; shared parameters; fake-object/contracts; constructor complexity/arguments; mutation |
| Factory/callback/observer/registry | Static/factory/naming restrictions; inline/generic/union types; private access; forwarding layers; interface limits |
| Move constants/types or remove wrappers | Existing domain modules; old/new minimum file sizes; import boundaries; remaining callers/exports |

Preserve concurrency, lifecycle, traversal order, caching, invalidation and performance invariants. Scope a repair to the complete API/caller/fixture boundary, not a disconnected handful of equally counted findings. Follow observed coupling when assigning later batches. Do not create another layer to fix a layer that exists only to silence a rule.

## Shared analyzer regression matrix

For false positives, establish valid-code evidence and the analyzer path causing the error. Require the formerly misreported valid case plus a nearby invalid case that must still report. Before full-project validation of a shared classification change, sample neighboring syntax/context forms and compare rule-level distributions.

For literal/constant indexing, include: a directly assigned scalar constant; nested object/array data; ordinary string uses; genuine repeated literals; nested scopes/aliases where relevant. Do not turn nested declaration data into ordinary usage when removing an incorrect constant binding. Keep unrelated rules unchanged.

For resolution/traversal, include callers and fixtures using the actual new contract, positive/negative resolution, re-exports, cache invalidation, ordering and boundary behavior relevant to the change. If the design changes twice, agree the owner and API first before another implementation attempt.

Add regression tests for meaningful behavior and analyzer semantics, not mechanical edits mirrored as tests. A focused green suite does not prove complete diagnostic equivalence; refresh the canonical inventory after shared analyzer edits. Separate genuine newly exposed findings from introduced errors and invalid parse-recovery output.
