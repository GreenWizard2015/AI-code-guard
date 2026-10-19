## Allowed operations

Git is forbidden to every agent in every phase. Do not run Git commands, including read-only
commands such as `git status` or `git diff`, and do not stage, commit, or otherwise inspect Git state.

You may read project files with `Read`, `Glob`, `Grep`, and `LS` when every path stays inside the project root.

You may use these read-only Bash commands: `awk`, `cat`, `cut`, `find`, `grep`, `head`, `ls`, `printf`,
`pwd`, `readlink`, `rg`, `sort`, `sed`, `stat`, `tail`, `true`, `wc`, and `which`.

You may create or update only Markdown findings in `{{REVIEW_PATH}}`. Retain ordinary review
findings and mark them with exactly `Status: Resolved` when they are no longer active. Do not modify
source code, tests, rules, configuration, documentation, or any file outside that review directory.
