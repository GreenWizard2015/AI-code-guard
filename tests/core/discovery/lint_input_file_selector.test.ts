import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TextFileDiscovery } from "src/core/discovery/text_file_discovery";
import { LintInputFileSelector } from "src/core/lint_input_file_selector";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { CountingProjectSourceIO } from "tests/io/counting_project_source_io";

describe("lint input selection", () => {
	test("shares one repository path inventory across source and text selection", () => {
		const root = "/virtual/input-selection-shared-paths";
		const source_file = join(root, "src", "service.ts");
		const markdown_file = join(root, "docs", "guide.md");
		const source_io = new CountingProjectSourceIO(
			new InMemoryProjectSourceIO(
				new Map([
					[source_file, "export class Service {}\n"],
					[markdown_file, "Documentation\n"],
				]),
			),
		);
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);
		const inputs = selector.input_files(root, []);

		expect({
			files: inputs.files,
			project_files: inputs.project_files,
			markdown_files: inputs.markdown_files,
			path_inventory_reads: source_io.source_path_calls(),
		}).toEqual({
			files: [source_file],
			project_files: [source_file],
			markdown_files: [markdown_file],
			path_inventory_reads: 1,
		});
	});

	test("does not return Git-ignored files during repository discovery", () => {
		const root = "/virtual/input-selection";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, ".gitignore"), "ignored.ts\n"],
				[join(root, "ignored.ts"), "export const ignored = true;\n"],
			]),
		);
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);
		const inputs = selector.input_files(root, [], [join(root, "ignored.ts")]);
		const result = { selected: inputs.files, cached: inputs.files };
		expect(result).toEqual({ selected: [], cached: [] });
	});

	test("reuses Gitignore matchers within a selection and refreshes them for the next selection", () => {
		const root = "/virtual/input-selection-gitignore-reuse";
		const ignored_file = join(root, "ignored.ts");
		const sources = new Map([
			[join(root, ".gitignore"), "ignored.ts\n"],
			[ignored_file, "export const ignored = true;\n"],
			[join(root, "kept.ts"), "export const kept = true;\n"],
		]);
		const source_io = new CountingProjectSourceIO(new InMemoryProjectSourceIO(sources));
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);

		const first = selector.input_files(root, []);
		const first_ignore_reads = source_io.source_text_calls();
		sources.set(join(root, ".gitignore"), "kept.ts\n");
		const second = selector.input_files(root, []);

		expect({
			first_files: first.files,
			first_ignore_reads,
			second_files: second.files,
			second_ignore_files: second.ignore_files,
		}).toEqual({
			first_files: [join(root, "kept.ts")],
			first_ignore_reads: 1,
			second_files: [ignored_file],
			second_ignore_files: [
				join(homedir(), ".config", "git", "ignore"),
				join(homedir(), ".gitignore_global"),
				join(root, ".git", "info", "exclude"),
				join(root, ".gitignore"),
			].sort(),
		});
	});

	test("returns an explicit visible target without scanning unrelated files", () => {
		const root = "/virtual/input-selection-visible";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "kept.ts"), "export const kept = true;\n"],
				[join(root, "other.ts"), "export const other = true;\n"],
			]),
		);
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);
		const selected = selector.input_files(root, [], [join(root, "kept.ts")]).files;
		expect(selected).toEqual([join(root, "kept.ts")]);
	});

	test("keeps explicit source paths unique", () => {
		const root = "/virtual/input-selection-duplicates";
		const file = join(root, "service.ts");
		const source_io = new InMemoryProjectSourceIO(new Map([[file, "export class Service {}\n"]]));
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);
		const inputs = selector.input_files(root, [], [file, file]);

		expect({ files: inputs.files, project_files: inputs.project_files }).toEqual({
			files: [file],
			project_files: [file],
		});
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
		const selector = new LintInputFileSelector(new TextFileDiscovery(source_io), source_io);
		const inputs = selector.input_files(root, [], [candidate]);

		expect(inputs.project_files).toContain(candidate);
	});
});
