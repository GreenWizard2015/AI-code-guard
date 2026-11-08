import { describe, expect, test } from "@jest/globals";
import { TaskFileSelector } from "src/core/support/task/reporting/workspace/task_file_selector";
import { TaskViolationGroups } from "src/core/support/task/reporting/workspace/task_violation_groups";
import { DiagnosticRule } from "src/model/diagnostic_rule";

describe("transformation diagnostic suppression", () => {
	test("directory findings suppress every descendant and preserve sibling findings", () => {
		const selector = new TaskFileSelector("/project");
		const directory_rule = new DiagnosticRule("directory-max-size");
		const nested_directory_rule = new DiagnosticRule("directory-class-max-size");
		const file_rule = new DiagnosticRule("file-max-size");
		const parent = directory_rule.violation("src/package", 1, { count: "501", size: "501" });
		const nested = nested_directory_rule.violation("src/package/feature", 1, { count: "501", size: "501" });
		const deep_nested = nested_directory_rule.violation("src/package/feature/deep", 1, { count: "501", size: "501" });
		const nested_file = file_rule.violation("src/package/feature/item.ts", 1, { count: "501" });
		const deep_nested_file = file_rule.violation("src/package/feature/deep/item.ts", 1, { count: "501" });
		const sibling_file = file_rule.violation("src/peer/peer.ts", 1, { count: "501" });
		const violations = [parent, nested, deep_nested, nested_file, deep_nested_file, sibling_file];
		const all = selector.select_all(violations, 10);

		expect({
			all_files: all.files,
			all_violations: all.violations.map((violation) => `${violation.file()}:${violation.rule_id()}`),
		}).toEqual({
			all_files: ["/project/src/package", "/project/src/peer/peer.ts"],
			all_violations: ["src/package:directory-max-size", "src/peer/peer.ts:file-max-size"],
		});
	});

	test("AI state directory metadata suppresses diagnostics inside the reported directory", () => {
		const selector = new TaskFileSelector("/project");
		const state_directory_rule = new DiagnosticRule("ai-code-guard-directory-ignored");
		const file_rule = new DiagnosticRule("file-max-size");
		const placement_rule = new DiagnosticRule("module-placement");
		const state_directory = state_directory_rule.violation(".ai-code-guard", 1, {});
		const state_file = file_rule.violation(".ai-code-guard/cache/report.md", 1, { count: "501" });
		const sibling_placement = placement_rule.violation("src/peer.ts", 1, {
			target: "Peer",
			members: "Peer",
			importers: "src/consumer.ts",
			placement_message: "misplaced",
			suggestions: "src/peer/peer.ts",
			guidance: "move it",
		});
		const selected = selector.select_all([state_directory, state_file, sibling_placement], 10);

		expect({
			files: selected.files,
			violations: selected.violations.map((violation) => `${violation.file()}:${violation.rule_id()}`),
		}).toEqual({
			files: ["/project/.ai-code-guard", "/project/src/peer.ts"],
			violations: [".ai-code-guard:ai-code-guard-directory-ignored", "src/peer.ts:module-placement"],
		});
	});

	test.each(["top-category", "all"] as const)(
		"%s preserves placement findings and suppresses other diagnostics on the same file",
		(policy) => {
			const selector = new TaskFileSelector("/project");
			const placement_rule = new DiagnosticRule("module-placement");
			const function_placement_rule = new DiagnosticRule("function-placement");
			const size_rule = new DiagnosticRule("file-max-size");
			const naming_rule = new DiagnosticRule("naming");
			const placement = placement_rule.violation("src/module.ts", 1, {
				target: "Module",
				members: "Module",
				importers: "src/consumer.ts",
				placement_message: "misplaced",
				suggestions: "src/module/module.ts",
				guidance: "move it",
			});
			const function_placement = function_placement_rule.violation("src/module.ts", 2, { ext: "ts" });
			const size = size_rule.violation("src/module.ts", 3, { count: "501" });
			const naming = naming_rule.violation("src/module.ts", 4, {
				kind: "class",
				name: "bad_name",
				word_count: "7",
			});
			const violations = [placement, function_placement, size, naming];
			let selected = selector.select_top_category(violations, 10);
			if (policy === "all") {
				selected = selector.select_all(violations, 10);
			}

			expect({
				files: selected.files,
				violations: selected.violations.map((violation) => violation.rule_id()),
			}).toEqual({
				files: ["/project/src/module.ts"],
				violations: ["module-placement", "function-placement"],
			});
		},
	);

	test("unclassified rules do not create directory or file-placement scopes", () => {
		const naming_rule = new DiagnosticRule("naming");
		const file_rule = new DiagnosticRule("file-max-size");
		const unclassified_directory_path = naming_rule.violation("src/package", 1, {
			kind: "class",
			name: "bad_name",
			word_count: "7",
		});
		const descendant_file = file_rule.violation("src/package/child.ts", 1, { count: "501" });
		const unclassified_file_path = naming_rule.violation("src/module.ts", 2, {
			kind: "class",
			name: "bad_name",
			word_count: "7",
		});
		const same_file_diagnostic = file_rule.violation("src/module.ts", 3, { count: "501" });
		const violations = [unclassified_directory_path, descendant_file, unclassified_file_path, same_file_diagnostic];
		const violation_groups = new TaskViolationGroups("/project", violations);
		const visible = violation_groups.analyze_visibility().visible;

		expect(visible.map((violation) => violation.rule_id())).toEqual([
			"naming",
			"file-max-size",
			"naming",
			"file-max-size",
		]);
	});

	test("canonicalizes absolute dot segments for grouping and placement suppression", () => {
		const root = "/project";
		const placement_rule = new DiagnosticRule("module-placement");
		const size_rule = new DiagnosticRule("file-max-size");
		const selector = new TaskFileSelector(root);
		const placement = placement_rule.violation("/project/src/../src/module.ts", 1, {
			target: "Module",
			members: "Module",
			importers: "src/consumer.ts",
			placement_message: "misplaced",
			suggestions: "src/module/module.ts",
			guidance: "move it",
		});
		const size = size_rule.violation("/project/src/module.ts", 2, { count: "501" });
		const groups = new TaskViolationGroups(root, [placement, size]);
		const selected = selector.select_all([placement, size], 10);

		expect({
			visible: groups.analyze_visibility().visible.map((violation) => violation.rule_id()),
			group_count: groups.violations_by_path().size,
			files: selected.files,
			selected_rules: selected.violations.map((violation) => violation.rule_id()),
		}).toEqual({
			visible: ["module-placement"],
			group_count: 1,
			files: ["/project/src/module.ts"],
			selected_rules: ["module-placement"],
		});
	});
});
