#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat >&2 <<'EOF'
Usage: measure-runs.sh --target /absolute/project/path [--clear-cache] [--runs N] [--linter-arg ARG ...]

Options:
	--target PATH    Existing absolute directory to lint.
	--clear-cache    Run cold: remove the complete known cache set before every measured run.
	--runs N         Number of comparable runs (default: 3).
	--linter-arg ARG Append one argument to every linter invocation; repeat for multiple arguments.
EOF
}

target=""
clear_cache=false
runs=3
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
		--clear-cache)
			clear_cache=true
			shift
			;;
		--runs)
			if (($# < 2)) || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
				usage
				exit 2
			fi
			runs="$2"
			shift 2
			;;
		--linter-arg)
			if (($# < 2)); then
				usage
				exit 2
			fi
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
measurement_id="$(date +%Y%m%d%H%M%S)"
performance_directory="$linter_root/.ai-code-guard/performance-runs/$measurement_id"
mkdir -p -- "$performance_directory"

clear_known_cache() {
	local state_dir="$target/.ai-code-guard"
	if [[ -d "$state_dir/cache" ]]; then
		rm -rf -- "$state_dir/cache"
	fi
}

run_guard() {
	local label="$1"
	local output_file="$2"
	set +e
	/usr/bin/time -f "${label}_WALL_TIME_SECONDS=%e" \
		"$guard_command" \
		--root "$target" \
		--policy all \
		--batch-size 10000 \
		"${linter_arguments[@]}" \
		>"$output_file" 2>&1
	run_exit=$?
	set -e
	cat -- "$output_file"
	printf '%s_EXIT=%s\n' "$label" "$run_exit"
	run_wall="$(sed -n "s/^${label}_WALL_TIME_SECONDS=//p" "$output_file" | tail -n 1)"
	run_issues="$(sed -n 's/^Total issues: \([0-9][0-9]*\)\.$/\1/p' "$output_file" | tail -n 1)"
	run_files="$(sed -n 's/^Total files: \([0-9][0-9]*\)\.$/\1/p' "$output_file" | tail -n 1)"
	result_path="$target/.ai-code-guard/cache/lint-execution/lint-result.json"
	if [[ -f "$result_path" ]]; then
		run_signature="$(node -e '
			const { createHash } = require("node:crypto");
			const { readFileSync } = require("node:fs");
			const record = JSON.parse(readFileSync(process.argv[1], "utf8"));
			if (!Array.isArray(record.violations)) {
				throw new TypeError("Cached lint result does not contain a violation array.");
			}
			const diagnostics = record.violations.map((item) => ({
				file: item.file,
				line: item.line,
				message: item.message,
				hint: item.hint,
				rule_id: item.rule_id,
				priority: item.priority,
			}));
			diagnostics.sort((left, right) => {
				const left_value = JSON.stringify(left);
				const right_value = JSON.stringify(right);
				if (left_value < right_value) return -1;
				if (left_value > right_value) return 1;
				return 0;
			});
			process.stdout.write(createHash("sha256").update(JSON.stringify(diagnostics)).digest("hex"));
		' "$result_path")"
	else
		run_signature="missing-full-diagnostic-result"
		consistency_status=2
	fi
	performance_file="$target/.ai-code-guard/performance.md"
	if [[ ! -f "$performance_file" ]]; then
		printf 'Missing performance report: %s\n' "$performance_file" >&2
		consistency_status=2
	else
		cp -- "$performance_file" "$performance_directory/${run_kind}_${label,,}.performance.md"
	fi
}

compare_run_value() {
	local name="$1"
	local expected="$2"
	local actual="$3"
	if [[ "$expected" != "$actual" ]]; then
		printf 'CONSISTENCY_ERROR=%s expected=%s actual=%s\n' "$name" "$expected" "$actual" >&2
		consistency_status=2
	fi
}

printf 'Linter workspace: %s\n' "$linter_root"
printf 'Target: %s\n' "$target"
printf 'Runs: %s\n' "$runs"
printf 'Cold run mode (--clear-cache): %s\n' "$clear_cache"

run_directory="$(mktemp -d /tmp/ai-code-guard-measure-XXXXXX)"
trap 'rm -rf -- "$run_directory"' EXIT

if [[ "$clear_cache" == false ]]; then
	clear_known_cache
	printf '\n===== CACHE WARM-UP =====\n'
	run_kind=warmup
	run_guard WARMUP "$run_directory/warmup.log"
fi

overall_status=0
consistency_status=0
expected_exit=""
expected_issues=""
expected_files=""
expected_signature=""
wall_times=()
for ((run = 1; run <= runs; run += 1)); do
	if [[ "$clear_cache" == true ]]; then
		clear_known_cache
	fi
	printf '\n===== RUN %s/%s =====\n' "$run" "$runs"
	if [[ "$clear_cache" == true ]]; then
		run_kind=cold
	else
		run_kind=warm
	fi
	run_guard "RUN_${run}" "$run_directory/run-${run}.log"
	printf 'RUN_%s_ISSUES=%s\n' "$run" "$run_issues"
	printf 'RUN_%s_FILES=%s\n' "$run" "$run_files"
	printf 'RUN_%s_SIGNATURE=%s\n' "$run" "$run_signature"
	wall_times+=("$run_wall")
	if ((run_exit != 0 && overall_status == 0)); then
		overall_status="$run_exit"
	fi
	if [[ -z "$expected_exit" ]]; then
		expected_exit="$run_exit"
		expected_issues="$run_issues"
		expected_files="$run_files"
		expected_signature="$run_signature"
	else
		compare_run_value exit "$expected_exit" "$run_exit"
		compare_run_value issues "$expected_issues" "$run_issues"
		compare_run_value files "$expected_files" "$run_files"
		compare_run_value signature "$expected_signature" "$run_signature"
	fi
done

average_wall="$(printf '%s\n' "${wall_times[@]}" | awk '{total += $1} END {if (NR > 0) printf "%.3f", total / NR; else print "nan"}')"
median_wall="$(printf '%s\n' "${wall_times[@]}" | sort -n | awk '
    { values[NR] = $1 }
    END {
        if (NR == 0) { print "nan"; exit }
        if (NR % 2 == 1) { printf "%.3f", values[(NR + 1) / 2]; exit }
        printf "%.3f", (values[NR / 2] + values[NR / 2 + 1]) / 2
    }
')"
printf '\nAverage measured wall time: %s seconds\n' "$average_wall"
printf 'Median measured wall time: %s seconds\n' "$median_wall"
printf 'Performance snapshots: %s\n' "$performance_directory"
if ((consistency_status == 0)); then
	printf 'Run consistency: PASS (exit=%s, issues=%s, files=%s, diagnostic multisets identical)\n' \
		"$expected_exit" "$expected_issues" "$expected_files"
else
	printf 'Run consistency: FAIL\n' >&2
fi

if ((consistency_status != 0)); then
	exit "$consistency_status"
fi
exit "$overall_status"
