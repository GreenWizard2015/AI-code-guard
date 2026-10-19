## Allowed operations

Git is forbidden to every agent in every phase. Do not run Git commands, including read-only
commands such as `git status` or `git diff`, and do not stage, commit, or otherwise inspect Git state.

You may read project files with `Read`, `Glob`, `Grep`, and `LS` when every path stays inside the project root.

You may use the permitted read-only Bash commands; Git commands are not allowed. You may update or delete only Markdown findings in
`{{REVIEW_PATH}}`. Delete a finding when it is not accepted as a confirmed major defect. Keep accepted
findings unchanged. Do not modify source code, tests, rules, configuration, documentation, or any file outside
the review directory.
