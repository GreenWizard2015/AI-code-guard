# responsibilities-wording

**Purpose:** Keep each responsibility as a concise ownership phrase rather than a description of
results or invocation mechanics.

Each responsibility may contain at most four words. Use a noun phrase that names the owned work,
not a verb phrase describing an outcome, a condition, or an invocation. Articles and inflected
action words are strong signals that the phrase is describing execution instead of ownership.

Examples:

- Outcome-oriented: `_produces direct parity results_` → `_parity result construction_`.
- Condition-oriented: `_determines whether paths match_` → `_path matching_`.
- Invocation-oriented: `_invokes reference handlers_` → `_reference handler dispatch_`.

The left side describes what happens during execution. The right side names the responsibility
itself, so it remains short, stable, and focused on ownership. Prefer phrases such as
`_user validation_`, `_record lookup_`, `_array type detection_`, and `_file-name suffix_`.

Do not remove meaningful ownership details merely to meet the limit. When the responsibility cannot
be stated honestly in four words without describing a result or invocation, split the owner or
choose a more direct domain phrase.
