#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
Usage: measure-runs.sh --target /absolute/project/path [--runs N] [--linter-arg ARG ...]

Options:
	--target PATH    Existing absolute directory to lint.
	--runs N         Number of cold/warm pairs (default: 3).
	--linter-arg ARG Append one argument to every linter invocation; repeat for multiple arguments.
	--baseline-cold-max SEC  Accepted baseline maximum cold time.
	--baseline-warm-max SEC  Accepted baseline maximum warm time.

Each pair clears the complete known cache, measures one cold run, then measures
one warm run using the cache produced by that cold run. Exit codes: 0 means the
measurement is valid and the timing threshold passed or was not requested; 1
means a valid measurement missed the requested timing threshold; 2 means the
measurement or arguments were invalid.
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
baseline_cold_max=""
baseline_warm_max=""
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
		--baseline-cold-max)
			if (($# < 2)) || ! [[ "$2" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
				usage
				exit 2
			fi
			baseline_cold_max="$2"
			shift 2
			;;
		--baseline-warm-max)
			if (($# < 2)) || ! [[ "$2" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
				usage
				exit 2
			fi
			baseline_warm_max="$2"
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

if [[ -n "$baseline_cold_max" && -z "$baseline_warm_max" ]] || [[ -z "$baseline_cold_max" && -n "$baseline_warm_max" ]]; then
	printf '%s\n' 'Provide both baseline maximum values or neither.' >&2
	usage
	exit 2
fi
if [[ -n "$baseline_cold_max" ]] && ((runs < 3)); then
	printf '%s\n' 'At least three cold/warm pairs are required for a timing decision.' >&2
	exit 2
fi

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
printf 'mode\trun\twall_seconds\texit\tissues\tfiles\n' >"$run_manifest"

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
		if [[ "$mode" == "warm" ]]; then
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

	printf '%s_SECONDS=%s EXIT=%s ISSUES=%s FILES=%s\n' \
		"$run_label" "$run_wall" "$run_exit" "${run_issues:-unavailable}" \
		"${run_files:-missing}"
	printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
		"$mode" "$run_number" "$run_wall" "$run_exit" \
		"${run_issues:-unavailable}" "${run_files:-missing}" >>"$run_manifest"
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

average() {
	printf '%s\n' "$@" | awk '{ total += $1 } END { if (NR > 0) printf "%.3f", total / NR; else print "nan" }'
}

median() {
	printf '%s\n' "$@" | sort -n | awk '
		{ values[NR] = $1 }
		END {
			if (NR == 0) { print "nan"; exit }
			if (NR % 2 == 1) { printf "%.3f", values[(NR + 1) / 2]; exit }
			printf "%.3f", (values[NR / 2] + values[NR / 2 + 1]) / 2
		}
	'
}

minimum() {
	printf '%s\n' "$@" | awk '
		NR == 1 || $1 < minimum { minimum = $1 }
		END { if (NR > 0) printf "%.3f", minimum; else print "nan" }
	'
}

maximum() {
	printf '%s\n' "$@" | awk '
		NR == 1 || $1 > maximum { maximum = $1 }
		END { if (NR > 0) printf "%.3f", maximum; else print "nan" }
	'
}

printf 'Linter workspace: %s\n' "$linter_root"
printf 'Target: %s\n' "$target"
printf 'Cold/warm pairs: %s\n' "$runs"
printf 'Score: best cold time + best warm time\n'

run_directory="$(mktemp -d /tmp/ai-code-guard-measure-XXXXXX)"
trap 'rm -rf -- "$run_directory"' EXIT

measurement_status=0
expected_files=""
cold_times=()
warm_times=()
paired_totals=()

for ((run = 1; run <= runs; run += 1)); do
	printf '\n===== PAIR %s/%s =====\n' "$run" "$runs"
	clear_known_cache
	printf 'Mode: cold (cache cleared)\n'
	run_guard cold "$run" "$run_directory/cold-${run}.log"
	cold_exit="$run_exit"
	cold_wall="$run_wall"
	cold_issues="$run_issues"
	cold_files="$run_files"
	cold_times+=("$cold_wall")
	printf 'Mode: warm (reuse cache produced by cold run)\n'
	run_guard warm "$run" "$run_directory/warm-${run}.log"
	warm_exit="$run_exit"
	warm_wall="$run_wall"
	warm_issues="$run_issues"
	warm_files="$run_files"
	warm_times+=("$warm_wall")
	paired_totals+=("$(awk -v cold="$cold_wall" -v warm="$warm_wall" 'BEGIN { printf "%.6f", cold + warm }')")

	if [[ -z "$expected_files" ]]; then
		expected_files="$cold_files"
	fi
	compare_run_value "$run cold analyzed files" "$expected_files" "$cold_files"
	compare_run_value "$run warm analyzed files" "$expected_files" "$warm_files"
done

# Sampling is intentionally deferred until all matched pairs finish. It must not
# add CPU or scheduling noise between a cold run and its paired warm run.
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

cold_average="$(average "${cold_times[@]}")"
cold_median="$(median "${cold_times[@]}")"
best_cold="$(minimum "${cold_times[@]}")"
cold_maximum="$(maximum "${cold_times[@]}")"
warm_average="$(average "${warm_times[@]}")"
warm_median="$(median "${warm_times[@]}")"
best_warm="$(minimum "${warm_times[@]}")"
warm_maximum="$(maximum "${warm_times[@]}")"
paired_median="$(median "${paired_totals[@]}")"
best_paired_total="$(minimum "${paired_totals[@]}")"
score="$(awk -v cold="$best_cold" -v warm="$best_warm" 'BEGIN { printf "%.3f", cold + warm }')"

printf '\nCold average: %s seconds\n' "$cold_average"
printf 'Cold median: %s seconds\n' "$cold_median"
printf 'Best cold: %s seconds\n' "$best_cold"
printf 'Maximum cold: %s seconds\n' "$cold_maximum"
printf 'Warm average: %s seconds\n' "$warm_average"
printf 'Warm median: %s seconds\n' "$warm_median"
printf 'Best warm: %s seconds\n' "$best_warm"
printf 'Maximum warm: %s seconds\n' "$warm_maximum"
printf 'Median paired total: %s seconds\n' "$paired_median"
printf 'Best paired total: %s seconds\n' "$best_paired_total"
printf 'Candidate minimum sum (best cold + best warm): %s seconds\n' "$score"
timing_status=0
if [[ -n "$baseline_cold_max" && -n "$baseline_warm_max" ]]; then
	baseline_maximum_sum="$(awk -v cold="$baseline_cold_max" -v warm="$baseline_warm_max" 'BEGIN { printf "%.3f", cold + warm }')"
	if awk -v candidate="$score" -v baseline="$baseline_maximum_sum" 'BEGIN { exit !(candidate < baseline) }'; then
		printf 'Timing threshold: PASS (candidate minima %s sec < baseline maxima %s sec)\n' "$score" "$baseline_maximum_sum"
	else
		printf 'Timing threshold: FAIL (candidate minima %s sec >= baseline maxima %s sec)\n' "$score" "$baseline_maximum_sum"
		timing_status=1
	fi
else
	printf '%s\n' 'Timing threshold: not evaluated (provide both baseline maximum values)'
fi
printf 'Performance snapshots: %s\n' "$performance_directory"
printf 'Run manifest: %s\n' "$run_manifest"
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
