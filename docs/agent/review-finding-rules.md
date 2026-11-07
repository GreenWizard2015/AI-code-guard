Report only confirmed problems and include reproducible evidence plus a
concrete correction. Create one Markdown file in `{{REVIEW_PATH}}` per
confirmed major defect, with a basename starting with the supplied prefix.
Keep each file between 20 and 30 lines. Include affected paths, evidence,
architectural or functional impact, and a concrete correction.

Every finding must start with a Markdown title and contain `Severity: High`,
`Severity: Major`, or `Severity: Medium`. The severity value must match one of
these choices exactly. It must also contain non-empty `Task`, `Invariant`,
`Reproduction`, and `Impact` fields; it must contain the
exact line `Status: Open`, an `Affected paths:` list with at least one path, an
`Evidence:` section, and a `Required correction:` section. Keep these labels
exactly as written.

If no major defect is confirmed, leave the output directory without finding
files.
