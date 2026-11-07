# Performance task journal

Read this reference only when starting a new performance task or updating its journal.

At the start of a new task, read any compatible baseline and relevant rejected hypotheses, then reset only `.ai-code-guard/linter-performance-log.md` for the new task. Carry forward concise baseline identity and rejected-attempt IDs. Do not delete timing snapshots or other files. A continuation, context compaction, baseline refresh, or next experiment in the same task is not a new start and must not clear the log.

Keep one concise header with target/command, baseline identity and ranges, load state, active experiment, and current diagnostic/correctness gates. Keep one short row per attempt with mechanism, score/threshold, verdict, diagnostic/check status, and attempt number. Store individual runs and detailed reports in the existing snapshots. Do not copy profiler dumps, timing tables, or repeated narrative into the log or create a second verbose journal. Update the header in place, keep the rejected-mechanism index compact, and preserve each attempt's unique outcome.

## Required 50-idea checklist

Keep exactly 50 distinct optimization ideas in the same performance journal. At a new task start, build the checklist after inspecting the pipeline, available profiles/sampler results, and compact history. Use stable IDs `I01`–`I50`, one short Markdown checkbox line per idea. Name a concrete code path/stage and mechanism, its status, and an attempt number when one exists. For example: `- [ ] I01 [proposed] <stage/path>: reuse <specific index> — <attempt number or profiling needed>`.

Use `[ ]` for proposed, active, or blocked ideas and `[x]` for evaluated ideas. State the outcome (`accepted`, `rejected`, `inconclusive`, or `not-applicable`) so a checked box never implies a speedup. Mark unmeasured ideas as hypotheses. Avoid duplicates, filler, and unrelated categories added only to reach 50. Ground entries in observed pipeline/code paths; profile evidence may still be pending. Prioritize sampler-selected work and note dependencies or prior rejected equivalents where relevant.

Update checklist entries when ideas are tested, blocked, or resolved, recording the attempt and concise outcome. Keep completed ideas visible; do not replace failed ideas to erase history or add another checklist. Multiple experiments may reference one idea. Fifty is an inventory, not a requirement to implement or run every idea. Preserve IDs and statuses on continuation; rebuild only for a genuinely new task.
