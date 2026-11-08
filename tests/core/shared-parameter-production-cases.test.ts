import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter integration additional production boundaries", () => {
	test.each([
		{
			name: "does not mix Python functions and methods",
			files: {
				"scope.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class Service:",
					"    def first(self, value: SharedInput):",
					"        return value",
					"    def second(self, value: SharedInput):",
					"        return value",
					"",
					"def third(value: SharedInput):",
					"    return value",
					"",
					"def fourth(value: SharedInput):",
					"    return value",
				].join("\n"),
			},
			expected_count: 0,
			included: [],
			excluded: [],
		},
		{
			name: "does not mix TypeScript functions and methods",
			files: {
				"scope.ts": [
					"class SharedInput {}",
					"class Service {",
					"  first(value: SharedInput) { return value; }",
					"  second(value: SharedInput) { return value; }",
					"}",
					"function third(value: SharedInput) { return value; }",
					"function fourth(value: SharedInput) { return value; }",
				].join("\n"),
			},
			expected_count: 0,
			included: [],
			excluded: [],
		},
		{
			name: "reports repeated parameters even when forwarded only to imported filesystem APIs",
			files: {
				"filesystem.ts": [
					'import * as node_file_system from "node:fs";',
					'import { resolve } from "node:path";',
					"class NodeFilePaths {",
					'  private readonly root: string = "";',
					"  path_exists(path: string): boolean { return node_file_system.existsSync(resolve(this.root, path)); }",
					"  symbolic_link(path: string): boolean { return node_file_system.lstatSync(resolve(this.root, path)).isSymbolicLink(); }",
					"  real_path(path: string): string { return resolve(node_file_system.realpathSync(resolve(this.root, path))); }",
					"  metadata(path: string): number { return node_file_system.statSync(resolve(this.root, path)).size; }",
					"}",
					"class NodeFileStorage {",
					'  private readonly root: string = "";',
					'  file_text(file: string): string { return node_file_system.readFileSync(resolve(this.root, file), "utf8"); }',
					'  write_text(file: string, text: string): void { node_file_system.writeFileSync(resolve(this.root, file), text, "utf8"); }',
					'  append_text(file: string, text: string): void { node_file_system.appendFileSync(resolve(this.root, file), text, "utf8"); }',
					"  remove_file(file: string): void { node_file_system.unlinkSync(resolve(this.root, file)); }",
					"}",
				].join("\n"),
			},
			expected_count: 2,
			included: ['parameter set "path:string"', 'parameter set "file:string"'],
			excluded: [],
		},
		{
			name: "reports repeated parameters when methods also interpret them locally",
			files: {
				"filesystem.ts": [
					'import * as node_file_system from "node:fs";',
					'import { resolve } from "node:path";',
					"class NodeFilePaths {",
					'  private readonly root: string = "";',
					"  path_exists(path: string): boolean { return path.length > 0 && node_file_system.existsSync(resolve(this.root, path)); }",
					"  symbolic_link(path: string): boolean { return path.length > 0 && node_file_system.lstatSync(resolve(this.root, path)).isSymbolicLink(); }",
					"  real_path(path: string): string { return path.length > 0 ? resolve(node_file_system.realpathSync(resolve(this.root, path))) : path; }",
					"  metadata(path: string): number { return path.length > 0 ? node_file_system.statSync(resolve(this.root, path)).size : 0; }",
					"}",
				].join("\n"),
			},
			expected_count: 1,
			included: ['parameter set "path:string"'],
			excluded: [],
		},
		{
			name: "counts private methods toward the support threshold",
			files: {
				"private.ts": [
					"class SharedInput {}",
					"class Service {",
					"  first(value: SharedInput) { return value; }",
					"  second(value: SharedInput) { return value; }",
					"  private hidden(value: SharedInput) { return value; }",
					"}",
				].join("\n"),
			},
			expected_count: 1,
			included: ['parameter set "value:SharedInput"'],
			excluded: [],
		},
		{
			name: "counts private Python methods toward support",
			files: {
				"private.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class Service:",
					"    def first(self, value: SharedInput):",
					"        return value",
					"    def second(self, value: SharedInput):",
					"        return value",
					"    def _hidden(self, value: SharedInput):",
					"        return value",
				].join("\n"),
			},
			expected_count: 1,
			included: ['parameter set "value:SharedInput"'],
			excluded: [],
		},
		{
			name: "ignores callable receiver parameters",
			files: {
				"receivers.ts": [
					"class Service {",
					"  first(this: Service) { return this; }",
					"  second(this: Service) { return this; }",
					"  third(this: Service) { return this; }",
					"  fourth(this: Service) { return this; }",
					"}",
				].join("\n"),
			},
			expected_count: 0,
			included: [],
			excluded: [],
		},
		{
			name: "ignores Python callable receiver parameters",
			files: {
				"receivers.py": [
					"class Service:",
					"    def first(self: Service):",
					"        return self",
					"    def second(self: Service):",
					"        return self",
					"    def third(self: Service):",
					"        return self",
					"    def fourth(self: Service):",
					"        return self",
				].join("\n"),
			},
			expected_count: 0,
			included: [],
			excluded: [],
		},
	])("$name", ({ files, expected_count, included, excluded }) => {
		const test_fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const violations: ViolationContract[] = test_fixture.with_shared_lint_request(
			lint_configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = test_fixture.shared_violations(violations).map((item) => item.message());
		const matched = included.map((fragment) => messages.some((message) => message.includes(fragment)));
		const absent = excluded.map((fragment) => messages.every((message) => !message.includes(fragment)));

		expect({ count: messages.length, matched, absent }).toEqual({
			count: expected_count,
			matched: included.map(() => true),
			absent: excluded.map(() => true),
		});
	});
});
