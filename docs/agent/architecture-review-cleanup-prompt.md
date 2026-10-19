Start a new architecture-review dialogue.
Working directory: {{ROOT}}

{{CLEANUP_ALLOWED_OPERATIONS}}

## Open review files
Read every Markdown review file listed below.

{{OPEN_REVIEWS}}

Evaluate each finding against SOLID, GRASP, separation of concerns, DRY, KISS,
YAGNI, and dependency-direction principles when relevant. Keep a finding only
when the principle violation has concrete architectural or functional impact;
delete findings that are merely stylistic references to a methodology.
Delete minor, speculative, duplicate, or non-architectural findings.
Keep only confirmed major architectural defects with concrete evidence and impact.
Delete every finding that is not accepted as a confirmed major defect. Do not modify source code, tests, rules, configuration, documentation, or any file outside the review directory.
Return the paths of the review files that remain.
