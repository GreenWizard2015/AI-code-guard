export const REPORT_SECTIONS = [
	"[info]",
	"[warning]",
	"Reference docs:",
	"Solutions, from most to least invasive:",
	"1. Try refactoring all callers",
	"Attempt every level in order; do not skip directly to the smallest change.",
	"Do not revert a change just because it reveals additional problems",
	"Design refactors carefully so classes remain immutable whenever possible",
	"If a problem cannot be fixed locally, analyze it from the perspective of the calling code.",
];

export const REPORT_COUNT_VIOLATIONS = [
	{
		file: "b.ts",
		line: 1,
		message: "one",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
	{
		file: "a.ts",
		line: 1,
		message: "one",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
	{
		file: "a.ts",
		line: 2,
		message: "two",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
];

export const REPORT_SORTED_VIOLATIONS = [
	...Array.from({ length: 4 }, (_, line) => ({
		file: "a.ts",
		line: line + 1,
		message: "a",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	...Array.from({ length: 3 }, (_, line) => ({
		file: "b.ts",
		line: line + 1,
		message: "b",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	...Array.from({ length: 2 }, (_, line) => ({
		file: "c.ts",
		line: line + 1,
		message: "c",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	})),
	{
		file: "d.ts",
		line: 1,
		message: "d",
		hint: "fix",
		rule_id: "parse-error",
		priority: 1 as const,
	},
];

export const CRITICAL_ONLY_VIOLATIONS = [
	{
		file: "worker.ts",
		line: 1,
		message: "module-level functions must be declared in the project-root functions file",
		hint: "FIRST move all functions to {project root}/functions.{ext}, then fix other problems. A cli.{ext} module may contain one entry-point function; keep all other behavior in domain classes. CLI startup wrappers may remain inline: use `if __name__ == '__main__':` in Python or `(function () { ... })();` in TypeScript.",
		rule_id: "function-placement",
		priority: 3 as const,
	},
	{
		file: "worker.ts",
		line: 2,
		message: "another problem",
		hint: "fix",
		rule_id: "parse-error",
		priority: 2 as const,
	},
];
