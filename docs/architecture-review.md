# Mandatory architecture review

ZERO LINT ISSUES IS NOT COMPLETION: a clean lint result does not replace a manual architectural review.

Before stopping, review the project code and document every confirmed architectural defect in a separate {{REVIEW_PATH}} file, including defects that the linter does not detect.

Inspect ownership and cohesion, module and directory boundaries, dependency direction and coupling, lifecycle and mutable state, alias/type/name resolution, duplicated behavior, hidden forwarding, catch-all modules, test architecture, and production-versus-test boundary leaks.

For every suspected defect, inspect its callers and data flow, explain the concrete architectural impact, and distinguish a confirmed defect from a minor issue or speculation.

If the review finds no major architectural problems, explicitly write that conclusion in your work log or final response; do not silently skip the review.

If no architectural defects are confirmed, copy this exact completion phrase into a review Markdown file: {{REVIEW_CODE}}. The phrase is the explicit no-problems confirmation; do not invent or alter it.

If any functions.ts, functions.tsx, or functions.py file exists, inspect every function and move it into its appropriate owning class or focused domain module; when no existing class is appropriate, create a real domain/state/lifecycle-owning class. Do not leave a catch-all functions file, namespace-shaped class, or wrapper-only class.

Do not record minor or speculative concerns, but do not omit a confirmed architectural defect merely because a lint rule already reports it or fails to report it.

This review is a mandatory linter completion gate. You MUST complete it before reporting success.

Run `ai-code-guard` again after the review, even when no review files were created, and stop only when the rerun confirms that no review task remains.
