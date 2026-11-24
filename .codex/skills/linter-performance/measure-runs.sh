#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
Usage: measure-runs.sh --target /absolute/project/path [--runs N] [--baseline-cold-hot-ratio RATIO] [--linter-arg ARG ...]

Options:
	--target PATH    Existing absolute directory to lint.
	--runs N         Number of matched cold/hot pairs (default: 3).
	--linter-arg ARG Append one argument to every linter invocation; repeat for multiple arguments.
	--baseline-cold-hot-ratio RATIO  Accepted best-cold / best-hot baseline ratio.

Each pair clears the complete known cache, measures one cold run, then measures
one hot run using the cache produced by that cold run. The primary score is the
minimum cold duration divided by the minimum hot duration across all requested
pairs. Exit codes: 0 means the measurement is valid and the ratio threshold
passed or was not requested; 1 means a valid measurement missed the requested
ratio threshold; 2 means the measurement or arguments were invalid.
EOF
}

interrupt_measurement() {
	local exit_code="$1"
	trap - INT TERM
	printf 'Benchmark interrupted; no further runs will start.\n' >&2
	exit "$exit_code"
}

trap 'interrupt_measurement 130' INT
trap 'interrupt_measurement 143' TERM

target=""
runs=3
baseline_cold_hot_ratio=""
linter_arguments=()

while (($# > 0)); do
	case "$1" in
		--target)
			if (($# < 2)); then
				usage
				exit 2
			fi
			target="$2"
			shift 2
			;;
		--runs)
			if (($# < 2)) || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
				usage
				exit 2
			fi
			runs="$2"
			shift 2
			;;
		--baseline-cold-hot-ratio)
			if (($# < 2)) || ! [[ "$2" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
				usage
				exit 2
			fi
			baseline_cold_hot_ratio="$2"
			shift 2
			;;
		--linter-arg)
			if (($# < 2)); then
				usage
				exit 2
			fi
			case "$2" in
				--root|--policy|--batch-size|--review-agent|--root=*|--policy=*|--batch-size=*|--review-agent=*)
					printf 'Cannot override required linter option: %s\n' "$2" >&2
					exit 2
					;;
			esac
			linter_arguments+=("$2")
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			printf 'Unknown option: %s\n' "$1" >&2
			usage
			exit 2
			;;
	esac
done

if [[ -z "$target" ]] || [[ "$target" != /* ]]; then
	printf '%s\n' '--target must be an existing absolute directory.' >&2
	usage
	exit 2
fi
if [[ ! -d "$target" ]]; then
	printf 'Target directory does not exist: %s\n' "$target" >&2
	exit 2
fi
target="$(realpath -e -- "$target")"
if [[ "$target" == "/" ]]; then
	printf '%s\n' 'Refusing to use / as the target directory.' >&2
	exit 2
fi

skill_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
linter_root="$(cd -- "$skill_dir/../../.." && pwd -P)"
guard_command="${AI_CODE_GUARD_BIN:-ai-code-guard}"
measurement_id="$(date +%Y%m%d%H%M%S%N)"
performance_directory="$linter_root/.ai-code-guard/performance-runs/$measurement_id"
mkdir -p -- "$performance_directory"
run_manifest="$performance_directory/runs.tsv"
printf 'mode\trun\twall_seconds\texit\tissues\tfiles\tfiles_per_second_info\n' >"$run_manifest"
pair_manifest="$performance_directory/pairs.tsv"
printf 'pair\tcold_seconds\thot_seconds\tcold_over_hot_ratio\tfiles\tcold_exit\thot_exit\tcold_issues\thot_issues\n' >"$pair_manifest"

clear_known_cache() {
	local cache_directory="$target/.ai-code-guard/cache"
	if [[ -d "$cache_directory" || -L "$cache_directory" ]]; then
		rm -rf -- "$cache_directory"
	fi
}

run_guard() {
	local mode="$1"
	local run_number="$2"
	local output_file="$3"
	local run_label="${mode^^}_${run_number}"
	local performance_file="$target/.ai-code-guard/performance.md"

	set +e
	/usr/bin/time -f "${run_label}_WALL_TIME_SECONDS=%e" \
		"$guard_command" \
		--root "$target" \
		--policy all \
		--batch-size 10000 \
		"${linter_arguments[@]}" \
		>"$output_file" 2>&1
	run_exit=$?
	set -e

	run_wall="$(sed -n "s/^${run_label}_WALL_TIME_SECONDS=//p" "$output_file" | tail -n 1)"
	run_issues="$(sed -n 's/^Total issues: \([0-9][0-9]*\)\.$/\1/p' "$output_file" | tail -n 1)"
	run_files=""
	if [[ ! "$run_wall" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
		printf 'CONSISTENCY_ERROR=%s missing wall time\n' "$run_label" >&2
		measurement_status=2
		run_wall=nan
	fi


	if [[ -f "$performance_file" ]]; then
		run_files="$(sed -n 's/^- Total files: \([0-9][0-9]*\)$/\1/p' "$performance_file" | tail -n 1)"
		if [[ "$mode" == "hot" ]]; then
			if ! grep -Eq '^\| startup\.complete-cache-read \|' "$performance_file" ||
				grep -Eq '^\| (file-analysis|global-analysis)(\.| \|)' "$performance_file"; then
				printf 'CONSISTENCY_ERROR=%s expected complete-cache hit without analysis stages\n' "$run_label" >&2
				measurement_status=2
			fi
		fi
		cp -- "$performance_file" "$performance_directory/${mode}_${run_number}.performance.md"
	else
		printf 'CONSISTENCY_ERROR=%s missing performance report\n' "$run_label" >&2
		measurement_status=2
	fi
	if [[ ! "$run_files" =~ ^[0-9]+$ ]]; then
		printf 'CONSISTENCY_ERROR=%s missing analyzed-file total\n' "$run_label" >&2
		measurement_status=2
	fi
	run_files_per_second="unavailable"
	if [[ "$run_files" =~ ^[0-9]+$ && "$run_wall" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
		run_files_per_second="$(awk -v files="$run_files" -v seconds="$run_wall" \
			'BEGIN { if (seconds > 0) printf "%.1f", files / seconds; else print "unavailable" }')"
	fi
	printf '%s_SECONDS=%s EXIT=%s ISSUES=%s FILES=%s SPEED_FILES_PER_SEC=%s\n' \
		"$run_label" "$run_wall" "$run_exit" "${run_issues:-unavailable}" \
		"${run_files:-missing}" "$run_files_per_second"
	printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
		"$mode" "$run_number" "$run_wall" "$run_exit" \
		"${run_issues:-unavailable}" "${run_files:-missing}" \
		"$run_files_per_second" >>"$run_manifest"
}

compare_run_value() {
	local name="$1"
	local expected="$2"
	local actual="$3"
	if [[ "$expected" != "$actual" ]]; then
		printf 'CONSISTENCY_ERROR=%s expected=%s actual=%s\n' "$name" "$expected" "$actual" >&2
		measurement_status=2
	fi
}

minimum() {
	printf '%s\n' "$@" | awk '
		NR == 1 || $1 < minimum { minimum = $1 }
		END { if (NR > 0) printf "%.3f", minimum; else print "nan" }
	'
}

printf 'Linter workspace: %s\n' "$linter_root"
printf 'Target: %s\n' "$target"
printf 'Cold/hot pairs: %s\n' "$runs"
printf 'Primary score: best cold / best hot (lower is better)\n'

run_directory="$(mktemp -d /tmp/ai-code-guard-measure-XXXXXX)"
trap 'rm -rf -- "$run_directory"' EXIT

measurement_status=0
expected_files=""
cold_hot_ratios=()
cold_times=()
hot_times=()

for ((run = 1; run <= runs; run += 1)); do
	printf '\n===== PAIR %s/%s =====\n' "$run" "$runs"
	clear_known_cache
	printf 'Mode: cold (cache cleared)\n'
	run_guard cold "$run" "$run_directory/cold-${run}.log"
	cold_exit="$run_exit"
	cold_wall="$run_wall"
	cold_times+=("$cold_wall")
	cold_issues="$run_issues"
	cold_files="$run_files"
	printf 'Mode: hot (reuse cache produced by cold run)\n'
	run_guard hot "$run" "$run_directory/hot-${run}.log"
	hot_exit="$run_exit"
	hot_wall="$run_wall"
	hot_times+=("$hot_wall")
	hot_issues="$run_issues"
	hot_files="$run_files"
	if ! awk -v cold="$cold_wall" -v hot="$hot_wall" 'BEGIN { exit !(cold > 0 && hot > 0) }'; then
		printf 'CONSISTENCY_ERROR=%s invalid cold/hot wall times: cold=%s hot=%s\n' \
			"$run" "$cold_wall" "$hot_wall" >&2
		measurement_status=2
	fi
	cold_hot_ratio="$(awk -v cold="$cold_wall" -v hot="$hot_wall" \
		'BEGIN { if (cold > 0 && hot > 0) printf "%.6f", cold / hot; else print "nan" }')"
	cold_hot_ratios+=("$cold_hot_ratio")
	printf 'PAIR_%s_COLD_OVER_HOT_RATIO=%s\n' "$run" "$cold_hot_ratio"
	printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
		"$run" "$cold_wall" "$hot_wall" "$cold_hot_ratio" "$cold_files" \
		"$cold_exit" "$hot_exit" "${cold_issues:-unavailable}" \
		"${hot_issues:-unavailable}" >>"$pair_manifest"

	if [[ -z "$expected_files" ]]; then
		expected_files="$cold_files"
	fi
	compare_run_value "$run cold analyzed files" "$expected_files" "$cold_files"
	compare_run_value "$run hot analyzed files" "$expected_files" "$hot_files"
done

# Sampling is intentionally deferred until all matched pairs finish. It must not
# add CPU or scheduling noise between a cold run and its paired hot run.
for ((run = 1; run <= runs; run += 1)); do
	cold_report="$performance_directory/cold_${run}.performance.md"
	if [[ -f "$cold_report" ]]; then
		printf '\nOptimization candidates from cold run %s:\n' "$run"
		if ! node "$skill_dir/sample-hotspots.mjs" "$cold_report"; then
			printf 'Hotspot sampling failed for cold run %s; measurement will continue.\n' "$run" >&2
		fi
	else
		printf 'Hotspot sampling skipped for cold run %s: report not found at %s\n' "$run" >&2
	fi
done

best_cold="$(minimum "${cold_times[@]}")"
best_hot="$(minimum "${hot_times[@]}")"
primary_ratio="$(awk -v cold="$best_cold" -v hot="$best_hot" \
	'BEGIN { if (cold > 0 && hot > 0) printf "%.6f", cold / hot; else print "nan" }')"

printf '\nCold/hot ratio per matched pair (informational): %s\n' "${cold_hot_ratios[*]}"
printf 'Best cold duration: %s seconds\n' "$best_cold"
printf 'Best hot duration: %s seconds\n' "$best_hot"
printf 'Primary score (best cold / best hot): %s\n' "$primary_ratio"
printf '%s\n' 'Speed (files/sec; informational only, not used for decisions):'
awk -F '\t' 'NR > 1 { printf "  %s_%s: %s\n", toupper($1), $2, $7 }' "$run_manifest"
timing_status=0
	if [[ -n "$baseline_cold_hot_ratio" ]]; then
	if awk -v candidate="$primary_ratio" -v baseline="$baseline_cold_hot_ratio" 'BEGIN { exit !(candidate < baseline) }'; then
		printf 'Cold/hot ratio threshold: PASS (candidate %s < baseline %s)\n' \
			"$primary_ratio" "$baseline_cold_hot_ratio"
	else
		printf 'Cold/hot ratio threshold: FAIL (candidate %s >= baseline %s)\n' \
			"$primary_ratio" "$baseline_cold_hot_ratio"
		timing_status=1
	fi
else
	printf '%s\n' 'Cold/hot ratio threshold: not evaluated (provide --baseline-cold-hot-ratio)'
fi
printf 'Performance snapshots: %s\n' "$performance_directory"
printf 'Run manifest: %s\n' "$run_manifest"
printf 'Pair manifest: %s\n' "$pair_manifest"
if ((measurement_status == 0)); then
	printf 'Measurement integrity: PASS (analyzed files=%s; diagnostic results are informational)\n' \
		"$expected_files"
else
	printf 'Measurement integrity: FAIL\n' >&2
fi

if ((measurement_status != 0)); then
	exit "$measurement_status"
fi
exit "$timing_status"
