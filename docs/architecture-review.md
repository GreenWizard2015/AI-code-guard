# Mandatory architecture review

ZERO LINT ISSUES IS NOT COMPLETION: a clean lint result does not replace an architectural review.

The primary agent MUST delegate this review to a separate review agent. The primary agent must give that agent the project root, the review scope below, and the required review-file format. The primary agent must not ask the review agent to generate, discover, or copy the completion code.

The delegated review agent must inspect the project code and document every confirmed major architectural defect in a separate {{REVIEW_PATH}} file. The delegated agent must inspect ownership and cohesion, module and directory boundaries, dependency direction and coupling, lifecycle and mutable state, alias/type/name resolution, duplicated behavior, hidden forwarding, catch-all modules, test architecture, and production-versus-test boundary leaks.

For every suspected defect, the delegated agent must inspect callers and data flow, explain the concrete architectural impact, and distinguish a confirmed defect from a minor issue or speculation. The delegated agent must report the review result to the primary agent after writing the Markdown files.

The completion code is private to the primary agent. The primary agent must write it only after the delegated agent reports that no major architectural defect was confirmed. If any defect is confirmed, the primary agent must fix it or leave the corresponding review file for the next run; the primary agent must not write the completion code.

The primary agent must always create at least one review Markdown file. If no architectural defects are confirmed, create a review Markdown file and add this exact line to it, replacing the placeholder with the private completion code supplied separately by the linter:

No issues marker: {{REVIEW_CODE}}

This line is the explicit no-problems confirmation; do not invent or alter the code. The delegated review agent must never receive this code or its value.

If any functions.ts, functions.tsx, or functions.py file exists, inspect every function and move it into its appropriate owning class or focused domain module; when no existing class is appropriate, create a real domain/state/lifecycle-owning class. Do not leave a catch-all functions file, namespace-shaped class, or wrapper-only class.

Do not record minor or speculative concerns, but do not omit a confirmed architectural defect merely because a lint rule already reports it or fails to report it.

This review is a mandatory linter completion gate. The primary agent MUST complete the delegated review before reporting success.

Run `ai-code-guard` again after the review and stop only when the rerun confirms that no review task remains.
