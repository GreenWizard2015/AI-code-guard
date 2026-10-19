import { join } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { LintInputFileSelector } from "src/core/lint_input_file_selector";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("lint input selection", () => {
	test("does not return Git-ignored files during repository discovery", () => {
		const root = "/virtual/input-selection";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, ".gitignore"), "ignored.ts\n"],
				[join(root, "ignored.ts"), "export const ignored = true;\n"],
			]),
		);
		const selector = new LintInputFileSelector(
			new TextFileDiscovery(new DiagnosticRule("cyrillic-comment"), source_io),
			source_io,
		);
		const inputs = selector.input_files(root, [], [join(root, "ignored.ts")]);
		const result = { selected: inputs.files, cached: inputs.files };
		expect(result).toEqual({ selected: [], cached: [] });
	});

	test("returns an explicit visible target without scanning unrelated files", () => {
		const root = "/virtual/input-selection-visible";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "kept.ts"), "export const kept = true;\n"],
				[join(root, "other.ts"), "export const other = true;\n"],
			]),
		);
		const selector = new LintInputFileSelector(
			new TextFileDiscovery(new DiagnosticRule("cyrillic-comment"), source_io),
			source_io,
		);
		const selected = selector.input_files(root, [], [join(root, "kept.ts")]).files;
		expect(selected).toEqual([join(root, "kept.ts")]);
	});

	test("retains dot-prefixed source files in repository-wide project context", () => {
		const root = "/virtual/input-selection-dot-prefix";
		const candidate = join(root, "..generated.ts");
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[candidate, "export const generated = true;\n"],
				[join(root, "sibling.ts"), "export const sibling = true;\n"],
			]),
		);
		const selector = new LintInputFileSelector(
			new TextFileDiscovery(new DiagnosticRule("cyrillic-comment"), source_io),
			source_io,
		);
		const inputs = selector.input_files(root, [], [candidate]);

		expect(inputs.project_files).toContain(candidate);
	});
});
