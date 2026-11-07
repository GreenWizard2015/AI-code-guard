# Hotspot report analysis

The script excludes the `Total measured stages` aggregate and first collects
the deepest positive-duration nodes on each branch. It never derives a node's
weight or duration by summing its children. It builds one weighted distribution
from those leaf nodes' own durations, draws 1,000 samples from it using a seed derived from the report contents, and ranks the
five most frequently selected nodes, breaking ties by duration. There is no
minimum-duration cutoff. Candidates with zero samples are omitted, so the
output can contain fewer than five results when the weighting is highly
concentrated. If only one positive-duration leaf exists, the script reports it
without a misleading sample percentage. Hotspot sampling accepts only
`cold_*.performance.md` snapshots; without a report path it selects the newest
cold snapshot and fails if none exists. Do not sample the mutable
`.ai-code-guard/performance.md`, which may contain warm-run timings.
`--temperature VALUE` adjusts the duration weights as
`duration^(1 / VALUE)` and defaults to `0.1`; `1` is proportional to time, lower
values favor the longest stages more strongly, and higher values spread
selections more evenly. Pass a report path as the first positional argument to
sample a different timing report. Use the sampled nodes to guide the next
hypotheses; the sample suggests where to inspect and does not replace profiler
evidence or the full-run acceptance measurements.
